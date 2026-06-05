# Surge 使用说明

本节以 Surge 为例，说明如何导入订阅、选择配置并开启代理。

## 下载与安装

Surge官网下载地址：https://apps.apple.com/us/app/surge-5/id1442620678 ，也可使用非大陆区苹果 Apple Store 直接下载，推荐使用美区 Apple ID 登录后在美区 Apple Store 下载，自己动手注册即可，无须付费购买账户
:::info
:icon[macOS](/help-assets/macos.png) macOS
:icon[macOS](/help-assets/macos.png) iOS
:::
![Surge](/help-assets/Surge1.jpg)

## 导入订阅链接

点击软件右上角的图标进入配置列表，如下图所示：
![Surge](/help-assets/Surge2.jpg)

在配置列表页面，点击【从URL下载配置】导入配置文件，如下图所示：
![Surge](/help-assets/Surge3.jpg)

在弹出的窗口中输入配置链接即节点订阅链接即可，如下图所示：
![Surge](/help-assets/Surge4.jpg)

成功导入配置文件后如下图所示，可以重命名为好记的文件，如下图所示：
![Surge](/help-assets/Surge5.jpg)

## 启用代理

在成功添加导入配置列表并选择配置列表之后，点击软件主最底部【首页】选项卡，可以看到最左上角已启用刚刚添加的配置文件，直接点击右边的【启动】按钮即可启用代理，如下图所示：
![Surge](/help-assets/Surge6.jpg)

## 出站模式

在软件【首页】选项卡，可以在最顶部看到出站模式，默认为规则模式，在成功启动并连接代理服务器后，直接点击【出站模式】就可以进行切换，如下图所示：
![Surge](/help-assets/Surge7.jpg)

:::tip
软件一共支持三种出站模式，分别是规则模式、全局模式、直连模式。

直接连接：所有请求直接发往目的地，即不使用代理
全局代理：所有请求直接发往代理服务器
规则模式：所有请求根据配置文件规则进行分流
:::

:::warning
全局代理可能会导致国内流量也走代理访问，除了网络会变慢外，还会消耗套餐流量。规则模式的好处就是区分国内国外的流量只有在规则内的国外网站才会走代理，这样即不影响国内访问速度，又节省套餐流量，所以如果没有什么特别的需求，一般选择 规则模式 即可。
:::

## 切换代理

点击出站模式下的【代理服务器】按钮，如下图所示：
![Surge](/help-assets/Surge8.jpg)

可以看到有很多节点，点击任意节点即可切换代理节点服务器，如下图所示：
![Surge](/help-assets/Surge9.jpg)
