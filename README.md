# ShareWAF_Blance
ShareWAF负载均衡

Auther：WangLiwen

http://www.ShareWAF.com/

# ShareWAF-Blance的特点
1、反向代理模式

2、随机负载目标

3、服务注册表式的动态负载

4、支持有状态通信

# 使用方法
打开Config.JS，进行配置

port为负载端口，接受Web访问

admin_port为负载管理端口，用于管理负载，添加、删除、查看负载

password为管理密码，进行管理操作时，要校验此密码

blance_pool为负载池，即多个负载目标，可以为ip或域名

（需最少添加一个负载目标，方可正常工作，但要达到负载效果，则至少需添加两个）

（可以在这里直接配置好，也可以启动后通过管理端口号访问进行动态添加、删除）

Ready,可以开始使用！

说明：同一访问者，会访问到同一负载目标，即：可负载有状态通信
