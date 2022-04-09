const router = require('koa-router')()
// 引入mongodb数据库
const mongo = require('../mongodb/mongoose');
const {robotUid, mockRobotHistory} = require('../robot');
const { wsMap } = require('../websocket');
const { initChatHistoryModel} = require('../mongodb/server');

router.prefix('/chat')

// 查询最近联系人会话
router.post('/contact',async (ctx, next)=> {

    const uid = ctx.request.header.uid; 
    const {linkManList, noValidation, sessionList, groupList} = await mongo.userLinkManModel.findOne({uid})

    // 查找联系人列表
    const _linkManList = linkManList.length ? await mongo.userModel.find({"_id": {$in: linkManList.map(item=> item.uid)}}, 
    {sex: 1,lastLoginTime:1, isOnLine:1, nickname:1,username:1,email:1,portrait:1, _id: 1, isOnLine: 1, signature: 1 }) : []

    // 查找验证列表
    const _noValidation = noValidation.length ? await mongo.userModel.find({"_id": {$in: noValidation}}, 
    {sex: 1,lastLoginTime:1, isOnLine:1, nickname:1,username:1,email:1,portrait:1 }) : []

    // const _noValidation = noValidation.length ? await mongo.chatHistoryModel.find({"_id": {$in: noValidation}}, 
    // {sex: 1,lastLoginTime:1, isOnLine:1, nickname:1,username:1,email:1,portrait:1 }) : []

    // 将converId字段加到联系人列表中返回, 返回一个mao后的联系人列表
    const mapLinkManList =  _linkManList.map(item=> ({
        sex: item.sex,
        lastLoginTime: item.lastLoginTime,
        isOnLine: item.isOnLine,
        nickname: item.nickname,
        username: item.username,
        email: item.email,
        portrait: item.portrait,
        signature: item.signature,
        uid: String(item._id),
        converId: (linkManList.find(man=> man.uid === String(item._id)) || {}).converId || robotUid,
    }))
    
    // 从联系人中过滤出来当前会话的对象。
    const mapLinkManListToSessionList = mapLinkManList.filter(item=> sessionList.includes(item.uid))

    
    
    ctx.response.body ={
        linkManList:  mapLinkManList,
        noValidation: _noValidation,
        sessionList: mapLinkManListToSessionList,
        groupList: groupList,
    }
})

// 查询聊天记录
router.post('/chatData',async (ctx, next)=> {
    const uid = ctx.request.header.uid;

    const {linkManList, groupList} = await mongo.userLinkManModel.findOne({uid})
    const LIST = [...linkManList.map(item=>item.converId), ...groupList]

    // console.log(LIST);

    // 从聊天记录中拿到最后一次聊天几率的内容并挂到会话列表上。
    const history = await mongo.chatHistoryModel.find({_id: {$in: LIST}}, 
    {owner: 1,history:1, lastHistory:1, type: 1, groupName: 1, members: 1 })

    ctx.response.body =[...history, mockRobotHistory]
})

// 以昵称搜索用户
router.post('/queryLinkman',async (ctx, next)=> {
    const { username } = ctx.request.body;
    const uid = ctx.request.header.uid;
    const reg = new RegExp(username)

    const {linkManList} = await mongo.userLinkManModel.findOne({uid})

    // 查找规则： 符合名称匹配且不为自己好友
    await mongo.userModel.find({ nickname: reg, "_id": {$nin: linkManList.map(item=> item.uid)}}).then(result=> {
        const _result =  result.map(item=> {
            const { username, lastLoginTime, isOnLine, portraitUrl, nickname, portrait, _id } = item;
            return { username, lastLoginTime, isOnLine, portraitUrl, nickname, portrait, _id }
        }).filter(item=> String(item._id) !== uid)
        // console.log(_result);
        ctx.response.body =[
            ..._result
        ]
    })
})

// 添加联系人
router.post('/addLinkMan',async (ctx, next)=> {
    const { username } = ctx.request.body;

    const uid = ctx.request.header.uid;
    const result = await mongo.userLinkManModel.findOne({username})
    const { noValidation } = result;

    // 如果验证数组里已经有了则直接return
    if(noValidation.includes(uid)) {
        ctx.response.body ={
            success: false,
            message: '请耐心等待对方验证'
        }
        return;
    }
    const _noValidation = [uid, ...noValidation];

    const linkManObj = await mongo.userModel.findOne({username})

    const userInfo = await mongo.userModel.findOne({_id: uid}, 
        {sex: 1,lastLoginTime:1, isOnLine:1, nickname:1,username:1,email:1,portrait:1 })
        
            
    // 当A用户请求加B好友，先去便利ws列表，如果该用户在线，就会直接受到好友请求。
    for(let map of wsMap) {
        const ws = map[0]
        const _uid = map[1]
        if(_uid === String(linkManObj._id)) {
            ws.send(JSON.stringify({
                type:'linkmanRequest',
                data: userInfo,
            }))
        }
    }
    await mongo.userLinkManModel.updateOne({username}, {noValidation: _noValidation}, { }, (result)=> {
        // console.log(result);
    })    
    ctx.response.body ={
        success: true,
    }
})

// 生成群聊
router.post('/createGroup',  async (ctx, next)=> {
    const { usersList, nickname } = ctx.request.body;
    const uid = ctx.request.header.uid;
    // mongo.chatHistoryModel.findOne({_id: '609f546516f4c23dc024eb48'}).populate('owner')
    // .exec((error, result)=> {
    //     console.log(error, result);
    // });

      // 先初始化出一个聊天记录，记录中保存着群主中的成员。
    // 将每个成员的group和session字段加入此聊天记录

    const { success, resultObj } = await initChatHistoryModel({
        members: [uid, ...usersList], 
        type: 'group', 
        groupName: `${nickname}创建的群聊`,
        owner: uid,
    })
    const converId = resultObj._id;

    await mongo.userLinkManModel.updateMany({uid: {$in: [...usersList, uid]}},
        {$push: {'groupList': converId}}, {}, (err, doc)=> {
            // console.log(doc, '群聊创建成功');
        })
  
    if(!success) {
        ctx.response.body ={
            success: false,
            code: 'fail',
            message: '创建失败',
        }
        return;
    }
    ctx.response.body ={
        success: true,
        code: 'success',
        message: '创建成功',
        resultObj,
    }
})

module.exports = router;

