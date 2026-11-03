import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Adapter, Enforcer, newEnforcer, newModelFromString } from 'casbin';
import { scopeCovers } from './subjects';

const MODEL_TEXT = readFileSync(join(__dirname, 'model.conf'), 'utf8');

export async function createEnforcer(adapter: Adapter): Promise<Enforcer> {
  const enforcer = await newEnforcer(newModelFromString(MODEL_TEXT), adapter);
  enforcer.enableAutoSave(false);
  await enforcer.addFunction('scopeCovers', scopeCovers);
  return enforcer;
}
