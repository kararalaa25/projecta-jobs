import test from 'node:test'
import assert from 'node:assert/strict'
import picomatch from 'picomatch'

// Regression guard for GHSA-fc5q-39xc-vjpf. The unpatched matcher emitted
// nested quantifiers such as /(?:[^/]*?a)+/ for single-branch repeated
// extglobs, which backtrack exponentially on short adversarial strings.
test('single-branch repeated extglobs do not emit nested quantifiers', () => {
  for (const pattern of ['+(*a)', '+(a*)', '+(*.js)']) {
    const source = picomatch.makeRe(pattern).source
    assert.equal(source.includes(')+'), false, `${pattern} still emits a nested quantifier: ${source}`)
  }
})

test('patched matcher preserves Vite-style glob behaviour', () => {
  assert.equal(picomatch.isMatch('src/main.jsx', 'src/**/*.jsx'), true)
  assert.equal(picomatch.isMatch('api/jobs.js', '**/*.js'), true)
  assert.equal(picomatch.isMatch('a.css', '**/*.css'), true)
  assert.equal(picomatch.isMatch('README.md', '**/*.js'), false)
  assert.equal(picomatch.isMatch('src/main.jsx', '+(*a)'), false)
})
