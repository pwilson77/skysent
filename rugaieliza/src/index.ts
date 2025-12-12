import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';
import { character } from './character.ts';
import rugai from "../RugAI.json";
import skysent from "../skysent.json";
import arcadius from "../arcadius.json";

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  logger.info({ name: character.name }, 'Name:');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  // plugins: [starterPlugin], <-- Import custom plugins here
};

// Add RugAI agent
const rugAIAgent: ProjectAgent = {
  character: rugai,
  init: async (runtime: IAgentRuntime) => {
    logger.info('Initializing RugAI character');
    logger.info({ name: rugai.name }, 'Name:');
  },
}

const skysentAgent: ProjectAgent = {
  character: skysent,
  init: async (runtime: IAgentRuntime) => {
    logger.info('Initializing SKYSENT character');
    logger.info({ name: skysent.name }, 'Name:');
  },
}

const arcadiusAgent: ProjectAgent = {
  character: arcadius,
  init: async (runtime: IAgentRuntime) => {
    logger.info('Initializing Arcadius character');
    logger.info({ name: arcadius.name }, 'Name:');
  },
}

const project: Project = {
  agents: [skysentAgent, arcadiusAgent],
};

export { character } from './character.ts';

export default project;
