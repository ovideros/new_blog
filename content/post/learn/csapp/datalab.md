---
title: CSAPP Datalab 实验报告
description: 实验一，用位运算实现整型与浮点数运算
slug: csapp_datalab
date: 2025-10-19
categories:
    - 学习
tags:
    - csapp
weight: 0
---

此前也有不少介绍 CSAPP Datalab 的内容[^1][^2][^3]。本文旨在记录我在课程中遇到的 CSAPP Datalab，提供一些个人的解题思路。本文中许多解法并非最优，只是代表了个人的思路。本文并非科普性质，更多是为了未来的自己所写。

> AI创作声明：本文全文手敲。Datalab 实验绝大部分未使用AI，但在howManyBits、intLog2函数上，询问过AI获取思路。

## 前置知识

C 语言基础，了解位运算。掌握 CSAPP 第二章内容，包括无符号数、有符号数的转换、运算，浮点数的IEEE标准与运算。

## 环境搭建

本文并不会仔细写如何搭建环境，建议有问题多问AI。

建议在x86_64架构[^4]的Linux环境下完成该Lab。因为我的笔记本是Mac，所以利用VSCode SSH连接远程ubuntu服务器完成。也可以选择使用希冀网站上的桌面，或者在Windows系统下使用WSL等方法。


## 函数分析

### bitXor函数

**函数要求：**

函数名 | bitXor
-|-
参数 | int x, int y
功能实现 | x^y
要求 | 只能使用 ~ 和 | 运算符，将结果返回。

**实现分析：**

由于 a^b = (a & ~b) | (~a & b)，
又因为 c | d = ~(~c & ~d)，
带入得到 a^b = ~(~(a & ~b) & ~(~a & b))

**函数实现：**

```C
int bitXor(int x, int y) {
  // 代码实现
  return ~(~(x & ~y) & ~(~x & y));
}
```

### getByte函数

**函数要求：**

函数名 | getByte
-|-
参数 | int x, int n
功能实现 |  从字x中取出第n个字节，从右开始计数
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

想要获取第 n 个字节，可以先让原先 x 右移 8n 个bit，
然后与0xFF进行&运算。为了获得8n，可以让n向左移位3位。

**函数实现：**

```C
int getByte(int x, int n) {
  return (x >> (n << 3)) & 0xFF;
}
```

### logicalShift函数

**函数要求：**

函数名 | logicalShift
-|-
参数 | int x, int n
功能实现 | 将x逻辑右移n位（左端补0）
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

C语言的右移>>运算符默认是算术右移，也就是负数右移会高位补0 。
可以进行分类，如果x为正数，直接返回x右移；如果x为负数，则右移后将高位变成0 。但是如果要实现分类，就刚好是后面的实现三元运算符。更简单的就是直接将高位变成0，无论x正负，这样更简便。

错误思路：
~~这说明需要构造 00...011...1这样的mask。为了利用C语言自带的右移，我们可以首先构造 011...1，然后右移 n-1 位即可。实际上无法使用减法-，于是只能先右移 n 位，然后左移 1 位。取反，得到 100...0，就只需要将 1 左移 31 位。~~

然而在右移 n 位再左移 1 位时，低位会变成 0，错误。

更改：为了构造 00...011...1 这样的mask，取反，就是要构造 11...100...0，于是在 100...0 基础上右移 n 位，然后左移 1 位。

**函数实现：**
```c
int logicalShift(int x, int n) {
  int mask = ((1 << 31) >> n) << 1;
  return ~mask & (x >> n);
}
```

### bitCount函数

**函数要求：**

函数名 | bitCount
-|-
参数 | int x
功能实现 | 返回该字中二进制 1 的个数
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

PPT 与课上讲过，参考即可：

- 将32位中每四位分组，首先利用位运算统计每个四位中1的个数（利用移位、掩码与加法）。
- 然后，将得到的32位的前16位与后16位相加。现在变成了4组4位的值，每个都累计了1的数量。
- 再按照第一步方法，进行累计将第一组加到第二组，第三组加到第四组，真正有效的变成了 0-3 位以及 8-11 位。
- 移位，将这两个有效的组加起来，最后与 0x3F (0b111111) 进行按位与运算，得到结果。之所以是 0x3F，因为 32 位最大就是有 32 个 1，最高会到 0b100000 。当然前面两个高位也是 0，实际上改成 0xFF也行。

最后实现的时候注意该C版本不支持后面定义，必须前面声明完所有变量。

**函数实现：**

```c
int bitCount(int x) {
  int mask0 = 0x11 | (0x11 << 8);
  int mask1 = mask0 | (mask0 << 16);
  int mask2; // old C standard, must declare it first.
  int sum = x & mask1;
  sum = sum + (x >> 1 & mask1);
  sum = sum + (x >> 2 & mask1);
  sum = sum + (x >> 3 & mask1);
  sum = sum + (sum >> 16);
  mask2 = 0xF | (0xF << 8);
  sum = (sum & mask2) + ((sum >> 4) & mask2);
  return (sum + (sum >> 8)) & 0x3F;
}
```

### conditional函数

**函数要求：**

函数名 | conditional
-|-
参数 | int x, int y, int z
功能实现 | int x, int y, int z
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

我们可以使用的操作符中，唯一与逻辑相关的就是非 ! 操作符。
所以，需要利用该符号来判断 x 是否为 0 。

错误想法：
~~仅当 x 为 0 时，!x 为 1，此时将 1 左移 31 位，就能得到全1的mask，与 z 进行按位与运算。同理，仅当 x 不为 0 时，!!x 为 1，此时左移 31 位，与 y 进行按位与运算。最后将两个结果用或连接即可。~~

错误理解了左移运算，还是右边补0，达不到想要的效果。
在左移 31 位后，再右移 31 位，这样根据算术右移，便能得到全1的mask。

**函数实现：**

```c
int conditional(int x, int y, int z) {
  return ((!!x << 31 >> 31) & y) | ((!x << 31 >> 31) & z);
}
```

### tmin函数

**函数要求：**

函数名 | tmin
-|-
参数 | void
功能实现 | 返回最小的补码
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

在 32 位下，最小补码就是 100..0，将 1 左移 31 位即可。

**函数实现：**

```c
int tmin(void) {
  return 1 << 31;
}
```

### fitsBits函数

**函数要求：**

函数名 | fitsBits
-|-
参数 | int x, int n
功能实现 | x的补码是否可以表示成n位 
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

对于正数与负数分类讨论。

在正数情况下，若能表示为 n 位补码，则其第 n 位必然为 0（否则补码为负数），
并且更高位也都为 0 。
可以将 x >> (n - 1) ，此时如果所有位都为 0，则说明满足条件。
可以使用异或运算^，然后取反，则满足条件时，返回1，否则返回0 。

在负数情况下，若能表示为 n 位补码，则其第 n 位必然为 1（否则补码为正数），
并且更高位也都为 1 。
可以将 x >> (n - 1) ，此时如果所有位都为 1，则说明满足条件。
可以使用异或运算^，然后取反，则满足条件时，返回1，否则返回0 。

可以看到，上面两者讨论有许多地方都可以简化。设 num 为 x >> (n - 1)，
则表达式为 !(num ^ 0) | !(num ^ ~0) 。

**函数实现：**
```c
int fitsBits(int x, int n) {
  int n_1 = n + ~1 + 1;
  int num = x >> n_1;
  return !(num ^ 0) | !(num ^ ~0);
}
```

### dividePower2函数

**函数要求：**

函数名 | dividePower2
-|-
参数 | int x, int n
功能实现 | 计算 x/(2^n)，其中 0 <= n <= 30
要求 | 向0取整。使用 ! ~ & ^ | + << >>

**分析：**

对于正数，只需要向右移位 n 即可。

对于负数，计算 (x + (1 << k) - 1) >> k，其中 k 为移位次数。
注意其中无法使用 - 1，换成 + (~1 + 1)。


**函数实现：**

```c
int dividePower2(int x, int n) {
  int mask = x >> 31;
  return (~mask & (x >> n)) | (mask & ((x + (1 << n) + (~1 + 1)) >> n));
}
```

### negate函数

**函数要求：**

函数名 | negate
-|-
参数 | int x
功能实现 | 返回 -x
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

负数等于取反加一。

**函数实现：**

```c
int negate(int x) {
  return ~x + 1;
}
```

### howManyBits函数

**函数要求：**

函数名 | howManyBits
-|-
参数 | int x
功能实现 | 返回表示 x 的补码所需的最少位数
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

首先，分析正数与负数。我们可以发现，正数需要找到最高位的1，然后将结果加1 。负数需要找到最高位的0，然后将结果加1 。这两者统一起来很简单——只需要对负数按位取反，就可以使用正数的逻辑。

接着，参考下方的intLog2函数，使用分治的思想，找到最高位。

在intLog2的count基础上加2，因为二进制1需要至少两位来表示，但是 intLog2(1) 的值为0 。

但是，这样对于二进制0来说，其intLog2不存在，而最少表示数为1 。因此加上特殊逻辑

**函数实现：**

```c
int howManyBits(int x) {
  int upper16, upper8, upper4, upper2, upper1;
  int mask16 = 1 << 31 >> 15;
  int mask8 = 0xff << 8;
  int mask4 = 0xf0;
  int mask2 = 0xc;
  int mask1 = 2;
  int count = 0;
  int is_negative = ((x >> 31) & 1) << 31 >> 31;
  x = (is_negative & ~x) | (~is_negative & x);
  upper16 = !(mask16 & x) << 31 >> 31;
  count = (~upper16 & 16) | (upper16 & 0);
  x = (~upper16 & (x >> 16)) | (upper16 & x);
  upper8 = !(mask8 & x) << 31 >> 31;
  count = (~upper8 & (count + 8)) | (upper8 & count);
  x = (~upper8 & (x >> 8)) | (upper8 & x);
  upper4 = !(mask4 & x) << 31 >> 31;
  count = (~upper4 & (count + 4)) | (upper4 & count);
  x = (~upper4 & (x >> 4)) | (upper4 & x);
  upper2 = !(mask2 & x) << 31 >> 31;
  count = (~upper2 & (count + 2)) | (upper2 & count);
  x = (~upper2 & (x >> 2)) | (upper2 & x);
  upper1 = !(mask1 & x) << 31 >> 31;
  count = (~upper1 & (count + 1)) | (upper1 & count);
  x = (~upper1 & (x >> 1)) | (upper1 & x);
  x = x << 31 >> 31;
  return (~x & 1) | (x & (count + 2));
}
```

### isLessOrEqual函数

**函数要求：**

函数名 | isLessOrEqual
-|-
参数 | int x, int y
功能实现 | 如果 x <= y，返回1；否则返回0
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

最简单的想法，就是让 y - x ，然后判断最高位的位数是否为1 。
如果是，则返回0；如果不是，则返回 1 。

因为不支持减法，所以写为 y + ~x + 1。然而，实际会遇到溢出问题，
包括正溢出与负溢出。

因为当x与y符号相同时，不会发生溢出现象，所以使用排除法——
当x为负且y为正时(signx & !signy)，此时一定满足，返回1，使用按位或运算与原等式连接；
当x为正且y为负时(signy & !signx)，此时一定不满足，返回0 。该逻辑操作可以将条件取反，然后与之前的式子进行按位与运算。这样当条件成立时，一定返回0，达到目的。

**函数实现：**

```c
int isLessOrEqual(int x, int y) {
  int sub = y + ~x + 1;
  int signx = x >> 31;
  int signy = y >> 31;
  return (!(signy & !signx)) & ((signx & !signy) | !((sub >> 31) & 1));
}
```

### intLog2函数

**函数要求：**

函数名 | intLog2
-|-
参数 | int x
功能实现 | 返回 floor(log2 x)，其中 x > 0
要求 | 使用 ! ~ & ^ | + << >>

**分析：**

要返回x的log2的值，就相当于要找到x的最高位1的位置。
例如，16的二进制为10000，就返回4；1的二进制为1，返回0 。
这说明返回值就是最高位1的值减一。

从最基本的角度来说，可以使用线性的方法，一次次看第n位是否为1，然后返回最大的。然而，这样显然相当低效，需要进行32次操作。

于是，考虑使用分治。首先判断高16位是否存在1。如果高位没有，则说明只考虑低16位的值；如果高位有1，则可以将高16位移位，并且结果加上16 。这些判断可以使用 conditional 函数的逻辑。例如 (~upper16 & 16) | (upper16 & 0) ，在 upper16 为全1时返回0，全0时返回16 。

继续分治，按照相同逻辑进行运算，从 32 -> 16 -> 8 -> 4 -> 2 -> 1。


**函数实现：**

```c
int intLog2(int x) {
  int upper16, upper8, upper4, upper2, upper1;
  int mask16 = 1 << 31 >> 15;
  int mask8 = 0xff << 8;
  int mask4 = 0xf0;
  int mask2 = 0xc;
  int mask1 = 2;
  int count = 0;
  upper16 = !(mask16 & x) << 31 >> 31;
  count = (~upper16 & 16) | (upper16 & 0);
  x = (~upper16 & (x >> 16)) | (upper16 & x);
  upper8 = !(mask8 & x) << 31 >> 31;
  count = (~upper8 & (count + 8)) | (upper8 & count);
  x = (~upper8 & (x >> 8)) | (upper8 & x);
  upper4 = !(mask4 & x) << 31 >> 31;
  count = (~upper4 & (count + 4)) | (upper4 & count);
  x = (~upper4 & (x >> 4)) | (upper4 & x);
  upper2 = !(mask2 & x) << 31 >> 31;
  count = (~upper2 & (count + 2)) | (upper2 & count);
  x = (~upper2 & (x >> 2)) | (upper2 & x);
  upper1 = !(mask1 & x) << 31 >> 31;
  count = (~upper1 & (count + 1)) | (upper1 & count);
  return count;
}
```

### floatAbsVal函数

**函数要求：**

函数名 | floatAbsVal
-|-
参数 | unsigned uf
功能实现 | 返回 uf 的绝对值，unsigned 理解为 float
要求 | 当参数为NaN时，直接返回参数

**分析：**

当 uf 不是 NaN 的时候，只需要将最高位改成0即可，很简单：
~(1 << 31) & uf 。

重点是判断 uf 是否为 NaN。NaN的8位exp都为1，且23位frac不全为0 。
前者条件可以表述为 (uf << 1 >> 24) == 0xff ，也就是将原数的exp去除，为 0xff；
后者条件表述为 (uf << 9) != 0 ，也就是frac位不全为 0。

**函数实现：**

```c
unsigned floatAbsVal(unsigned uf) {
  if (((uf << 1 >> 24) == 0xff) & ((uf << 9) != 0))
    return uf;
  return ~(1 << 31) & uf;
}
```

###s floatScale1d2函数

**函数要求：**

函数名 | floatScale1d2
-|-
参数 | unsigned uf
功能实现 | 返回 0.5*f
要求 | 当参数为NaN时，直接返回参数；可以使用任何操作符，以及流程

**分析：**

当参数为 NaN 时，直接仿照上面函数的逻辑判断，并返回输入。
对于exp为全1的情况，说明此时代表无穷大，除以二仍然不变，因此可以并入相同逻辑。

除以2不会改变符号，所以符号位应该不变。

如果除以2之前与之后，exp都处在规格化之内，那么只用将exp减去1即可。
这对应了 exp >= 0x02 的情况。

当 exp == 0x01 时，说明此时浮点数从规格化值变为非规格化值，将小数部分最高位之外增加1位1，对这个整体进行偶数舍入除以2，变成新的小数部分。

当 exp == 0x00 时，此时在非规格的情况下操作，取小数部分按偶数舍入除以2。

**函数实现：**

```c
unsigned floatScale1d2(unsigned uf) {
  unsigned sign = (uf >> 31) & 1;
  unsigned exp = uf << 1 >> 24;
  unsigned frac = uf & 0x7fffff;
  unsigned round, guard;
  if (exp == 0xff)
    return uf;
  if (exp >= 0x02) {
    exp -= 1;
  } else {
    if (exp == 0x01) {
      exp = 0;
      frac = (1 << 23) | frac;
    }
    round = frac & 1;
    frac = frac >> 1;
    if (round == 1) {
      guard = frac & 1;
      if (guard == 1) {
        frac += 1;
      }
    }
  }
  return (sign << 31) | (exp << 23) | frac;
}
```

### floatFloat2Int函数

**函数要求：**

函数名 | floatFloat2Int
-|-
参数 | unsigned uf
功能实现 | 返回 (int) uf 的位级表示
要求 | 当输入超出 int 表示范围时（包括NaN与inf），返回 0x80000000u

**分析：**

仿照刚才逻辑，若exp位为全1，直接返回 0x80000000u。

计算指数位代表的2的指数大小，利用 e = exp - bias。如果 e 小于 0，则直接返回0；若 e 大于等于 31，说明超出 int 表示范围，返回 0x80000000u 。

接下来需要对小数位进行移位操作。一次2的乘法，就相当于1次移位。

在小数位最高位多增加一位1，然后根据 e 与 23 的大小关系，选择向左或者向右移位，得到结果。

最后，根据符号正负，正数直接返回，负数需要返回补码（取反加一）。


**函数实现：**

```c
int floatFloat2Int(unsigned uf) {
  unsigned sign = (uf >> 31) & 1;
  unsigned exp = uf << 1 >> 24;
  unsigned frac = uf & 0x7fffff;
  unsigned bias = 127;
  unsigned result;
  int e = exp - bias;
  int index = 23 - e;
  if (exp == 0xff)
    return 0x80000000u;
  if (e < 0)
    return 0;
  if (e >= 31)
    return 0x80000000u;
  if (index >= 0) {
    result = ((1 << 23) | frac) >> index;
  } else {
    result = ((1 << 23) | frac) << (-index);
  }
  if (!sign) {
    return result;
  } else {
    return ~result + 1;
  }
}
```

## 实验总结

该实验通过位运算的角度，加强了对于int底层表示、float表示的理解。

对于难度为4的题目，确实需要较多的思考。bitCount在课上讲过，所以可以写出来。
不过 howManyBits 与 intLog2 之前没有见过。一开始感觉根本没有思路，因为无法进行32次每一位的操作。后面询问AI（仅做辅导提示作用，没有直接给出答案），提示我利用分治的方法思考，我便找到了解法。确实相当巧妙。

还有许多细节上的问题。例如，!运算是这当中应该积极使用的操作符，可以将所有非0的值映射为0，只有0还是1 。结合上移位操作，便可以当做条件判断使用。这在许多地方都有应用。

以及对于mask，可以手动构造，截取指定的位，进行分析。这在浮点数操作中有应用。

对于减法减去x，可以使用 + ~x +1 实现。当x是一个较小的常数时，此方法都有用。但是特别注意，如果 x 本身接近 Tmin 或者 Tmax，会造成加法或者说减法的正溢与负溢，这在isLessOrEqual函数中有所体现。

浮点数中，floatScale1d2要注意舍入到偶数的逻辑——利用舍入后的最低位guard，进行分类判断。floatFloat2Int中，判断移位的正负，进而对小数位进行移位，得到转换后的正数。为了实现这个函数，我也在C语言中自己尝试了float到int的强制类型转换，其舍入逻辑就是简单的截断小数位，或者说向0舍入。



## 参考资料

[^1]: 更适合北大宝宝体质的 Data Lab 踩坑记. https://arthals.ink/blog/data-lab
[^2]: CSAPP 之 DataLab详解，没有比这更详细的了. 知乎. https://zhuanlan.zhihu.com/p/59534845
[^3]: 实验 1：Data Lab. CSAPP 电子书. https://hansimov.gitbook.io/csapp/labs/data-lab
[^4]: x86-64. Wikipedia. https://en.wikipedia.org/wiki/X86-64