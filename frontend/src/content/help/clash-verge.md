# Clash Verge 使用说明

本节以 Clash Verge Rev 为例，说明如何导入订阅并完成基础配置。

## 下载与安装

请先从 Clash Verge Rev 官方文档获取最新版本并完成安装。
:::info
:icon[Windows](/help-assets/windows.png) Windows（不再支持 Win7）
:icon[macOS](/help-assets/macos.png) macOS
:::
## 导入订阅

打开客户端后，导入你在本网站复制的订阅链接或订阅配置。
![verge](/help-assets/verge_import.png)
:::info
如果你还没有订阅链接，可以先回到网站的「我的订阅」页面，选择对应客户端模板后再复制链接。
:::

## 选择节点和模式

导入完成后，进入代理或节点页面，选择你要使用的节点，并根据需要切换规则模式、全局模式或直连模式。
![verge](/help-assets/verge_proxy.png)

## 打开代理（或 Tun 模式）
启用系统代理后，大部分浏览器和常规应用就可以开始走代理连接。
![verge](/help-assets/verge_enable_sysproxy.png)
:::tip
系统代理：（原理：通过上方开关自动修改操作系统的代理设置）能处理大部分通过浏览器的科学上网需求。
Tun 模式：(使用前请确保你已阅读相关教程)在系统中安装虚拟网卡，以接管不支持“系统代理”的程序（例如游戏和命令行）。
:::

:::warning
开启 Tun 模式前，请先确认系统与客户端版本支持该功能，并阅读客户端自带说明，避免和现有网络设置冲突。
:::
