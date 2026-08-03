import { createSignal } from "solid-js";
import type { Event } from "@opencode-ai/sdk/v2";
import type { Command, Layer } from "@opentui/keymap";
import type {
  TuiCommand,
  TuiPlugin,
  TuiPluginApi,
  TuiPluginMeta,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui";
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "./config";
import { ControllerRegistry } from "./registry";
import { SidebarPet } from "./sidebar";
import type { PetConfig } from "./types";

const ADAPTER_EVENT_TYPES = [
  "session.next.step.started",
  "session.next.prompted",
  "session.next.prompt.admitted",
  "session.next.reasoning.started",
  "session.next.reasoning.ended",
  "session.next.text.started",
  "session.next.text.ended",
  "session.next.tool.input.started",
  "session.next.tool.called",
  "session.next.shell.started",
  "session.next.tool.success",
  "session.next.shell.ended",
  "session.next.tool.failed",
  "session.next.retried",
  "session.next.step.failed",
  "permission.asked",
  "permission.v2.asked",
  "permission.replied",
  "permission.v2.replied",
  "question.asked",
  "question.v2.asked",
  "question.replied",
  "question.rejected",
  "question.v2.replied",
  "question.v2.rejected",
  "session.status",
  "session.idle",
  "session.error",
] as const satisfies readonly Event["type"][];

type ConfigUpdater = (config: PetConfig) => PetConfig;

function eventSessionID(event: Event): string | undefined {
  const properties = event.properties;
  if (typeof properties !== "object" || properties === null || !("sessionID" in properties)) return undefined;
  const sessionID = properties.sessionID;
  return typeof sessionID === "string" ? sessionID : undefined;
}

function once(dispose: () => void): () => void {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    dispose();
  };
}

function legacyCommands(updateConfig: (update: ConfigUpdater) => void): TuiCommand[] {
  return [
    {
      title: "Shigure: Show/Hide Pet",
      value: "opco-shigure.toggle",
      category: "Shigure",
      description: "显示或隐藏时雨宠物",
      onSelect: () => updateConfig((config) => ({ ...config, enabled: !config.enabled })),
    },
    {
      title: "Shigure: Use Regular/Compact Size",
      value: "opco-shigure.size",
      category: "Shigure",
      description: "切换时雨宠物尺寸",
      onSelect: () =>
        updateConfig((config) => ({ ...config, size: config.size === "regular" ? "compact" : "regular" })),
    },
    {
      title: "Shigure: Enable/Disable Animations",
      value: "opco-shigure.animations",
      category: "Shigure",
      description: "启用或禁用时雨动画",
      onSelect: () => updateConfig((config) => ({ ...config, animations: !config.animations })),
    },
  ];
}

export const tui: TuiPlugin = async (api: TuiPluginApi, _options, _meta: TuiPluginMeta): Promise<void> => {
  // no-excuse-ok: catch — the plugin boundary must never throw into OpenCode.
  try {
    if (api.lifecycle.signal.aborted) return;

    const registry = new ControllerRegistry();
    const initialConfig = api.kv.ready ? loadConfig(api.kv) : DEFAULT_CONFIG;
    if (!api.kv.ready) console.debug("[opco-shigure] kv unavailable; using defaults");

    const [cfg, setCfg] = createSignal<PetConfig>(initialConfig);
    const updateConfig = (update: ConfigUpdater): void => {
      const next = update(cfg());
      setCfg(next);
      if (api.kv.ready) saveConfig(api.kv, next);
    };

    try {
      api.slots.register({
        order: 600,
        slots: {
          sidebar_content: (_ctx, props) =>
            SidebarPet({
              api,
              session_id: props.session_id,
              controllers: registry,
              cfg,
            }),
        },
      });
    } catch {
      console.debug("[opco-shigure] slot registration failed; pet UI disabled");
    }

    const unsubscribers: Array<() => void> = [];
    for (const eventType of ADAPTER_EVENT_TYPES) {
      try {
        const unsubscribe = api.event.on(eventType, (event) => {
          try {
            registry.dispatch(event);
          } catch {
            console.debug("[opco-shigure] event handler failed", {
              type: event.type,
              sessionID: eventSessionID(event),
            });
          }
        });
        unsubscribers.push(once(unsubscribe));
      } catch {
        console.debug("[opco-shigure] event subscription failed", { type: eventType });
      }
    }

    const commands = [
      {
        name: "opco-shigure.toggle",
        title: "Shigure: Show/Hide Pet",
        category: "Shigure",
        namespace: "palette",
        desc: "显示或隐藏时雨宠物",
        run: () => updateConfig((config) => ({ ...config, enabled: !config.enabled })),
      },
      {
        name: "opco-shigure.size",
        title: "Shigure: Use Regular/Compact Size",
        category: "Shigure",
        namespace: "palette",
        desc: "切换时雨宠物尺寸",
        run: () =>
          updateConfig((config) => ({ ...config, size: config.size === "regular" ? "compact" : "regular" })),
      },
      {
        name: "opco-shigure.animations",
        title: "Shigure: Enable/Disable Animations",
        category: "Shigure",
        namespace: "palette",
        desc: "启用或禁用时雨动画",
        run: () => updateConfig((config) => ({ ...config, animations: !config.animations })),
      },
    ] satisfies readonly Command[];
    // No `mode` on this layer: mode-gated layers are excluded while the command
    // palette is open (observed in the todo 8 real smoke), which would make all
    // three commands unreachable. bindings is empty, so no keys are captured.
    const layer = { commands, bindings: [] } satisfies Layer;

    let keymapDisposer: (() => void) | undefined;
    try {
      if (typeof api.keymap.registerLayer === "function") {
        keymapDisposer = once(api.keymap.registerLayer(layer));
      } else {
        const legacyDisposer = api.command?.register(() => legacyCommands(updateConfig));
        keymapDisposer = legacyDisposer ? once(legacyDisposer) : undefined;
      }
    } catch {
      console.debug("[opco-shigure] registerLayer unavailable; trying legacy commands");
      try {
        const legacyDisposer = api.command?.register(() => legacyCommands(updateConfig));
        keymapDisposer = legacyDisposer ? once(legacyDisposer) : undefined;
      } catch {
        console.debug("[opco-shigure] legacy commands unavailable");
      }
    }
    if (!keymapDisposer) console.debug("[opco-shigure] keymap unavailable; commands disabled");

    api.lifecycle.onDispose(
      once(() => {
        for (const unsubscribe of unsubscribers) unsubscribe();
        keymapDisposer?.();
        registry.disposeAll();
        console.debug("[opco-shigure] disposed");
      }),
    );
    console.debug("[opco-shigure] loaded", { eventTypes: ADAPTER_EVENT_TYPES.length });
  } catch {
    console.debug("[opco-shigure] initialization failed; continuing without pet");
  }
};

const plugin: TuiPluginModule = { id: "opco-shigure", tui };

export default plugin;
