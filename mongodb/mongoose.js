// Mongoose 是一个让我们可以通过Node来操作MongoDB数据库的一个模块
// Mongoose 是一个对象文档模型（ODM）库，它是对Node原生的MongoDB模块进行了进一步的优化封装
// 大多数情况下，他被用来把结构化的模式应用到一个MongoDB集合，并提供了验证和类型装换等好处
// 基于MongoDB驱动，通过关系型数据库的思想来实现非关系型数据库

const url = "mongodb://127.0.0.1:27017/WebIM";
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {robotUid} = require('../robot');

mongoose.set('useFindAndModify', false)

class MongoDB {
    constructor(mongoose) {
        this.mongoose = mongoose;
        this.DB_URL = url;
        this.userModel = null; // 用户模型
        this.chatHistoryModel = null; // 聊天历史记录模型
        this.userLinkManModel = null; // 用户联系人模型

        this.initModelSchema()
        this.connect()
        // 生成聊天机器人
        this.createRobot()
    }

    // 初始化集合的模型
    initModelSchema() {
        // 用户模型
        this.userModel = this.mongoose.model('User',new Schema({
            // 用户名
            username : { type: String, require: true},
            // 昵称
            nickname: {type: String, require: true},
            // 密码
            password : { type: String, require: true},
            // 性别
            sex : { type: Number, require: false, default: 0},
            // 邮箱
            email : { type: String, require: true},
            // 签名
            signature: { type: String},
            // 用户是否在线
            isOnLine: { type: Boolean, default: false},
            // avatar卡通头像
            avatar : { type: Schema.Types.Mixed, require: false},
            // 最后一次登录时间
            lastLoginTime: { type: Number, require: false, default: new Date().getTime()},
            // 用户注册时间
            registerTime: { type: Number, require: false, default: new Date().getTime()}
        }))

        // 历史聊天记录模型
        this.chatHistoryModel = this.mongoose.model('ChatHistory',new Schema({
            // 聊天参与人员
            members: [{type:  Schema.Types.ObjectId, ref: 'User'}],
            // 历史记录
            history: { type: Array, default: []},
            // 最新历史记录
            lastHistory: {type: Schema.Types.Mixed, default: {}},
            // 聊天类型(session单聊、group群聊)
            type: { type: String, default: ''},
            // 群组名称
            groupName: { type: String},
            // 群的所有者
            owner: { type: Schema.Types.ObjectId},
            // 群公告
            notice: { type: String}
        }))

        // 用户联系人模型
        this.userLinkManModel = this.mongoose.model('UserLinkMan',new Schema({
            // 用户名
            username: {type: String},
            // 用户id
            uid: { type: String},
            // 联系人列表(存放联系人id,聊天历史记录id)
            linkManList: { type: Array},
            // 会话列表(存放联系人id)
            sessionList:{ type: Array, default: []},
            // 用户朋友请求是否通过
            noValidation: { type: Array, default: []},
            // 群组列表
            groupList: [{ type: Schema.Types.ObjectId, ref: 'ChatHistory'}]
        }))
    }

    // mongodb数据库初始化连接
    connect() {
        this.mongoose.connect(this.DB_URL,
            { useNewUrlParser: true, useUnifiedTopology: true}, (err)=>{
                if(!err){
                    console.log("数据库连接成功")
                }
            }
        )
    }

    // 用户注册
    register(accountObj) {
        return new Promise(async (resolve, reject)=> {
            const{ username } = accountObj;
            const resultObj = await this.find({username})
            if((resultObj || []).length > 0) {
                resolve({
                    code: 'fail',
                    success: false,
                    message: '用户已注册'
                });
                return;
            }

            this.userModel.create({
                lastLoginTime: new Date().getTime(),
                nickname: username,
                ...accountObj}
            )
            .then(user=> {
                resolve({
                    code: 'success',
                    success: true,
                    user,
                })
            })
        })
    }

    // 用户登录
    login({username, password}) {
        return new Promise((resolve, reject)=> {
            this.find({username, password})
            .then((result)=> {
                if((result || []).length > 0) {
                    resolve({
                        code: 'success',
                        success: true,
                        uid: result[0]._id,
                    });
                }else {
                    resolve({
                        code: 'fail',
                        success: false,
                    });
                }
            })
        })
    }

    // 查找
    find( queryObject = {}) {
        return new Promise((resolve)=> {
            this.userModel.find(queryObject).then(result=> {
                resolve(result)
            })
        })
    }

    // 初始化聊天机器人
    async createRobot() {
        const resultObj = await this.find( {username: 'admin-robot'} )

        if((resultObj || []).length > 0) {
            return;
        }

        this.userModel.create({
            username: 'admin-robot',
            sex : 1,
            isOnLine: true,
            _id: robotUid,
            nickname: '机器人',
            email: '123@qq.com',
            signature: '有什么不明白的可以问我哦',
            avatar : {
                AvatarStyle : "Transparent",
                Top : "NoHair",
                Accessories : "Wayfarers",
                HairColor : "Auburn",
                FacialHair : "Blank",
                FacialHairColor : "Black",
                Cloth : "Overall",
                ClothColor : "Black",
                Eyes : "Close",
                Eyebrow : "Angry",
                Mouth : "Smile",
                Skin : "Black",
            }
        })
    }
}

let mongo = new MongoDB(mongoose, url)

module.exports = mongo;
