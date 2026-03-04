import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS, executeToolCall } from './tools.ts';

describe('tool registry', () => {
  it('exports at least 30 tool definitions', () => {
    assert.ok(TOOL_DEFINITIONS.length >= 30, `Expected >= 30 tools, got ${TOOL_DEFINITIONS.length}`);
  });

  it('every tool has name, description, and input_schema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(tool.name, `Tool missing name`);
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.ok(tool.input_schema, `Tool ${tool.name} missing input_schema`);
      assert.strictEqual(tool.input_schema.type, 'object', `Tool ${tool.name} schema type should be object`);
    }
  });

  it('tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map(t => t.name);
    const unique = new Set(names);
    assert.strictEqual(names.length, unique.size, `Duplicate tool names found`);
  });

  it('tool names use snake_case', () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(/^[a-z][a-z0-9_]*$/.test(tool.name), `Tool name ${tool.name} should be snake_case`);
    }
  });

  it('executeToolCall returns error object for unknown tool', async () => {
    const result = await executeToolCall('nonexistent_tool', {});
    assert.ok(typeof result === 'object');
    assert.ok('error' in (result as any));
  });
});
