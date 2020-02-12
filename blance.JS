//*****************************************/
// Blance
// ShareWAF.com 负载均衡模块
// Auther: WangLiwen
//*****************************************/

/**
 * 使用方法：
 * 打开Config.JS，进行配置
 * port为负载端口，接受Web访问
 * admin_port为负载管理端口，用于管理负载，添加、删除、查看负载
 * password为管理密码，进行管理操作时，要校验此密码
 * blance_pool为负载池，即多个负载目标，可以为ip或域名
 * （需最少添加一个负载目标，方可正常工作，但要达到负载效果，则至少需添加两个）
 * （可以在这里直接配置好，也可以启动后通过管理端口号访问进行动态添加、删除）
 * Ready,可以开始使用！
 * 
 * 说明：同一访问者，会访问到同一负载目标，即：可负载有状态通信
 */

//三方模块
var express = require("express")();
var http_proxy = require("http-proxy");
var body_parser = require("body-parser");
var admin_express = require("express")();
var fs = require("fs");

//调试信息
var debug = require("./config.js").debug;

//日志
var log = require("./config.js").log;

//端口
var port = require("./config.js").port;
//管理密码
var password = require("./config.js").admin_password;
//管理端口
var admin_port = require("./config.js").admin_port;

//调试开关
var debug = true;
//代理
var proxy = http_proxy.createProxyServer({});
//存放目标
var pool = require("./config.js").blance_pool;
//特征池，实现同一人访问同一目标
var signatures = [];

//监听
express.listen(port);
admin_express.listen(admin_port);

console.info("ShareWAF-Blance v1.0.2");
console.info("Blance server at port:",port);
console.info("Blance admin server at port:",admin_port);
console.info("Copyright (c) 2020 ShareWAF.com");

//管理后台
admin_express.get("/",function(req,res){
    
	fs.readFile("./blance.html",function(err,std_out,std_err){  
        res.writeHead(200,{'Content-type':"text/html"});   
		if(!err){  
			res.end(std_out);  
		}else{
            res.end("Error while read blance.html");
        }  
	})  
});

proxy.on("error",function(err,req,res){
    try{
        res.end("error");
    }catch(e){
        console.log(e.message);
    }
});

//body-parser
express.use(body_parser.urlencoded({extended: true}));

//注册
express.post("/register_blance",function(req,res,next){

    //密码，用于校验
    if(req.body.password == password){

        //添加到负载均衡池
        pool.push(req.body.target);

        console.log("add blance:" + req.body.target);

        res.end("blance added!");
    }else{
        console.log("register blance error: password error!");
        res.end("error!");
    }
    
    return;
});

//获取列表
express.post("/get_blance_list",function(req,res,next){

    //密码，用于校验
    if(req.body.password == password){
        console.log("get_blance_list" + pool.toString());
        res.end(pool.toString());
    }else{
        console.log("register blance error: password error!");
        res.end("error!");
    }
    
    return;
});

//反注册
express.post("/unregister_blance",function(req,res,next){
    //密码，用于校验
    if(req.body.password == password){

        //特征池移除索引
        var remove_signature_index = 0;

        //移除成功标识
        var remove_flag = 0;

        //遍历
        for(i=0; i<pool.length; i++){

            //匹配
            if(pool[i] == req.body.target){

                //删除
                delete pool[i];
                pool.splice(i,1);

                console.log("remove blance:" + req.body.target);

                //从特征池中移除
                delete signatures[i];
                signatures.splice(i,1);
                console.log("signatures remove blance:" + req.body.target);

                res.end("blance removed!");

                remove_flag = 1;
            }
        }

        if(remove_flag == 0){
            res.end("unregister blance error:blance not exist!");
            console.log("error,blance not exist")
        }

        //遍历特征池
        for(i=0; i<signatures.length; i++){

            if(signatures[i].time * 1 + 1000 * 60 * 10 <= (new Date).getTime()){

                console.log("remove signature:" + signatures[i]);

                delete signatures[i];
                signatures.splice(i,1);

            }
        }
        
    }else{
        console.log("unregister blance error: password error!");
        res.end("error!")
    }
    return;
});

//随机访问负载
express.use(function(req,res,next){

    if(pool.length == 0){
        console.log("error: blance pool is null.")
        res.end("Error:No blance! Config first,Please!");
        return;
    }

    //随机数
    var rnd = random_number(0,pool.length - 1);

    //访问者特征：IP+AGENT
    var req_signature = get_req_ip(req) + req.headers["user-agent"];
    
    //从特征库中获取负载目标
    for(i=0; i<signatures.length; i++){

        if(signatures[i].signature == req_signature){
            rnd = signatures[i].index;
            console.log("get blance from signature pool:" + i + ".");

            signatures[i].time = (new Date).getTime();
        }
    }
    
    //访问
    proxy.web(req, res, {target: pool[rnd], selfHandleResponse : false, changeOrigin:true} );
    console.log("blance visit: " + rnd + " " + pool[rnd] + ",url:" + req.url);

    //遍历，检查特存是否已存入特征池
    for(i=0; i<signatures.length; i++){

        if(signatures[i].signature == req_signature){
            return;    
        }
    }
    //保存到特征池
    signatures.push({signature:req_signature, index:rnd, time:(new Date).getTime()});

})

//10秒检查一次，将特征池中超时的特征移除
setInterval(function(){
    //遍历特征池
    for(i=0; i<signatures.length; i++){

        if(signatures[i].time * 1 + 1000 * 60 * 10 <= (new Date).getTime()){

            console.log("remove signature:" + signatures[i]);

            delete signatures[i];
            signatures.splice(i,1);

        }
    }
},1000 * 10)

//获取访问者ip
var get_req_ip = function(req) {
	try{
		var ip = req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress || "";

        if(ip.split(",").length > 0){
			ip = ip.split(",")[0];
		}
		return ip.replace("::ffff:", "");
	}catch(e){
		console.log("error while get client ip." + e.message);
		return "127.0.0.1";
	}
};

//范围内随机数
function random_number(min,max){
    var range = max - min;
    var rand = Math.random();
    var num = min + Math.round(rand * range);
    return num;
}

//API hook，处理console.log
var old_console_log = console.log;
console.log = function(msg){
    if(debug == 1){
        old_console_log("\u001b[32m" + msg +"\u001b[0m");
    }
    if(log == 1){
        fs.appendFile("log.txt", new Date() + " " + msg + "\r\n",function(e){
            if(e){
                console.error("Error while write to log.txt:",e.message);
            }
        });
    }
}
