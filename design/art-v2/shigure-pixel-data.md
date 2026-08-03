# 时雨无图像像素交接数据

这份文件是给不能查看 PNG 的 Agent 使用的规范。PNG 是视觉母稿；以下行字符串才是可直接实现的像素输入。

## 调色板与图例

| 索引 | 字符 | 颜色 | 语义 |
|---:|:---:|:---|:---|
| 0 | `.` | `transparent` | `transparent` |
| 1 | `0` | `#2A1D1A` | `hair_shadow` |
| 2 | `1` | `#4A2B24` | `hair_base` |
| 3 | `2` | `#704739` | `hair_light` |
| 4 | `3` | `#FFD0B4` | `skin` |
| 5 | `4` | `#4BA9FF` | `eye_blue` |
| 6 | `5` | `#153A78` | `eye_deep` |
| 7 | `6` | `#242634` | `uniform` |
| 8 | `7` | `#F1E8DF` | `trim_warm_white` |
| 9 | `8` | `#C52F3C` | `ribbon_red` |
| 10 | `9` | `#141820` | `sock_black` |
| 11 | `a` | `#4B2624` | `boot_red_brown` |
| 12 | `b` | `#17141B` | `outline` |

## Regular 24×24 idle seed

### Regular semantic mask (优先于颜色细节)

`H`=宽发，`F`=脸，`E`=蓝眼，`B`=单侧细辫，`W`=暖白侧板/领口，`U`=制服，`R`=红领结/裙边，`K`=黑袜，`T`=短靴，`.`=透明。

```text
........................
........................
.......HHHHHHHHHH.......
.....HHHHHHHHHHHHHH.....
....HHHHHHHHHHHHHHHH....
...HHHHHFFFFFFFHHHHH...
...HHHHFEEFFFEEHHHHB....
...HHHHFEEFFFEEHHHHB....
....HHHHFFFFFFFHHHHHB..
.....HHHHFFFFFHHHHHB...
....HHHWWUUUUUWHHHHB....
....HHHWUURRUUWHHHHB...
....HHHWURRRUUWHHHHB...
....HHHWWUUUUUWHHHH....
.....HHHUUUUUUUHHH....
......HHHURRRUHH......
.......HHHRRRHH.......
........KK..KK........
........KK..KK........
........KK..KK........
........KK..KK........
........TT..TT........
........TT..TT........
........TT..TT........
```

上面的 `E` 两侧必须各形成独立蓝眼簇；`B` 必须从头部一侧连续落到胸前，不能变成第二条马尾。

```text
........................
........bbbbbbbb........
......ba111111111b......
....b11110a11111111bbb..
....102a101110101220bbb.
...b11112b12212201a1b...
..b188011b111b2111110...
..b0b2b08301b33001100b..
..bb01bbbb11b3bb3010bb..
...b71b75533075601bbb...
...0b1b35533335381b00...
..b1bb0b33333332bb0b1b..
..000b0bb.282.08b0b000..
bb10bbb3b2b8b0b3b00bb10b
.1b0bb33bbb8a67b302b0b1.
b0b0b60b7.08a772a60b0.0.
...b32b6b6b8b966b70b.b..
....0b0a66666b.0ab0b....
.......bbb...bbb........
........0.b.b00b........
.......3..b..b.2........
......b0a0...02ab.......
.......bbb...bbbb.......
........................
```

### Regular monochrome silhouette

```text
                                                
                ████████████████                
            ████████████████████████            
        ████████████████████████████████████    
        ██████████████████████████████████████  
      ████████████████████████████████████      
    ████▓▓▓▓██████████████████████████████      
    ████████████▓▓▓▓██████▓▓▓▓██████████████    
    ██████████████████████▓▓████▓▓██████████    
      ██████████▓▓▓▓▓▓▓▓████▓▓████████████      
      ████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████      
    ████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓██████████████    
    ██████████████  ██▓▓██  ██▓▓████████████    
██████████████▓▓██████▓▓██████▓▓████████████████
  ██████████▓▓▓▓██████▓▓████████▓▓████████████  
██████████████████  ██▓▓██████████████████  ██  
      ██▓▓████████████▓▓████████████████  ██    
        ████████████████████  ██████████        
              ██████      ██████                
                ██  ██  ████████                
              ▓▓    ██    ██  ██                
            ████████      ████████              
              ██████      ████████              
                                                
```

## Compact 16×16 idle seed

### Compact semantic mask

```text
................
...HHHHHHHHHH...
..HHHHHHHHHHHH..
.HHHHFFFFFFHHHB.
.HHHHEEFFEEHHHB.
.HHHHEEFFEEHHHB.
.HHHHFFFFFFHHHB.
.HHHWWUUUWHHHB..
.HHHWURRUWHHHB..
.HHHWURRUWHHH...
..HHHURRUHHH....
..HHHRRRHHH.....
...KK..KK.......
...KK..KK.......
...TT..TT.......
...TT..TT.......
```

```text
................
....b11a110b....
...0011101101bb.
..10221210220b..
..a21ba11300ba..
.b11bb813bbbbbb.
..002563353020..
..abb3333330b1..
.0bbb37b8a2bb00.
bb0b8b.8.930b00b
bb02b.78b7b63b..
..b3a6b6666b3...
.....8b.b8b.....
.....bb.b.b.....
....ba0..aa.....
................
```

### Compact monochrome silhouette

```text
                                
        ████████████████        
      ████████████████████████  
    ████████████████████████    
    ██████████████▓▓████████    
  ██████████▓▓██▓▓████████████  
    ██████▓▓██▓▓▓▓▓▓▓▓██████    
    ██████▓▓▓▓▓▓▓▓▓▓▓▓██████    
  ████████▓▓████▓▓████████████  
████████▓▓██  ▓▓  ██▓▓██████████
██████████  ██▓▓████████▓▓██    
    ██▓▓████████████████▓▓      
          ▓▓██  ██▓▓██          
          ████  ██  ██          
        ██████    ████          
                                
```

## 七状态无图动作契约

- `idle`：base silhouette; frame 2 changes one eye/bang pixel only。
- `thinking`：move both blue eye clusters one pixel upward and tilt the fringe one pixel。
- `working`：move both forearms inward; keep skirt, socks, boots and hair baseline fixed。
- `waiting`：raise face one pixel and bring hands together below the ribbon。
- `success`：move complete boot/foot groups upward by one logical pixel; no ground line。
- `error`：lower head and shoulders; narrow eyes but retain one blue pixel per eye group。
- `retry`：alternate a one-pixel horizontal lean of the upper body between frames。

## 实现边界

- 两档尺寸必须独立修整，不能把 regular 缩放后直接当 compact。
- 每个状态都继承 idle 的宽发、椭圆脸、双蓝眼、单侧细辫、白侧板、红长领结、裙袜靴分层。
- 运行期使用编译后的索引矩阵；不在 TUI 内读取 PNG。
- 若美术 Agent 要调整像素，必须先更新 JSON 和本文件的行字符串，再更新运行时资产。
