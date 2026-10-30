import test from 'node:test'
import assert from 'node:assert/strict'
import {backendReason,safeBackendCode} from '../server/backend-errors.js'
test('backend diagnostics distinguish URL, credentials, schema, grants and network errors without exposing values',()=>{
 assert.equal(backendReason(Error('Invalid supabaseUrl: private-value')),'configuration')
 assert.equal(backendReason({code:'42501'}),'permissions')
 assert.equal(backendReason({code:'42703'}),'schema')
 assert.equal(backendReason({},401),'credentials')
 assert.equal(backendReason({message:'TypeError: fetch failed'}),'connection')
 assert.equal(safeBackendCode({code:'ERR_INVALID_URL'}),'ERR_INVALID_URL')
 assert.equal(safeBackendCode({code:'secret-api-token'}),undefined)
 assert.equal(safeBackendCode({code:'PGRST205'}),'PGRST205')
})
