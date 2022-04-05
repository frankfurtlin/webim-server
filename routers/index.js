const router = require('koa-router')()

router.get('/', async (ctx, next) => {
  ctx.body = 'Hello Koa 2!'
})

router.get('/json', async (ctx, next) => {
  ctx.body = {
    title: 'koa2 json'
  }
})

module.exports = router
