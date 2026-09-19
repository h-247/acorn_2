import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';

export const taxonomyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/skills', async () => {
    const store = db.getStore();
    return store.skills;
  });

  fastify.get('/tree', async () => {
    const store = db.getStore();
    const rootSkills = store.skills.filter((s) => !s.parentId);
    return rootSkills.map((root) => ({
      ...root,
      children: store.skills.filter((child) => child.parentId === root.id),
    }));
  });
};
