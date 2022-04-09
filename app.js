const Koa = require('koa')
const app = new Koa()
const fs = require('fs')
const json = require('koa-json')
const bodyparser = require('koa-bodyparser')
const onerror = require('koa-onerror')
const cors = require('koa-cors')
const morgan = require('koa-morgan')
require('./websocket/index')

// error handler
onerror(app)

// middlewares
app.use(bodyparser({
  enableTypes: ['json', 'form', 'text']
}))
app.use(json())

// create a writing stream (in append mode)
const accessLogStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' })
// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))

app.use(cors())


const index = require('./routers/index')
const users = require('./routers/account')
const chat = require('./routers/chat')

// routers
app.use(index.routes(), index.allowedMethods())
app.use(users.routes(), users.allowedMethods())
app.use(chat.routes(), chat.allowedMethods())

module.exports = app
