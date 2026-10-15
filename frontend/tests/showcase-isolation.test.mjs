import test from 'node:test'
import assert from 'node:assert/strict'
import { designPreviewPlugin } from '../design-preview.mjs'

test('showcase middleware isolates tagged requests and rejects mutations before proxying', () => {
  let handler
  designPreviewPlugin({ taggedOnly:true }).configureServer({ middlewares:{ use(fn){handler=fn} } })
  let forwarded = false
  handler({ method:'GET',url:'/api/eta/drafts',headers:{} }, {}, () => {forwarded=true})
  assert.equal(forwarded,true)
  for (const method of ['GET','POST','DELETE']) {
    let body
    const res = {setHeader(){},end(value){body=JSON.parse(value)}}
    handler({ method,url:'/api/eta/drafts',headers:{'x-fawterx-showcase':'1'} },res,() => assert.fail('Tagged request escaped to live proxy'))
    assert.equal(res.statusCode,method === 'GET' ? 200 : 403)
    if(method === 'GET') assert.equal(body.drafts[0].draftId,'design-draft')
  }
})
