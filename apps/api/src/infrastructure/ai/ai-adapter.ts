import { AIGenerateRequest, AICandidateDTO, AIGenerationStatus, CEFRLevel } from '@acorn/contracts';
import { randomUUID } from 'crypto';

export interface AIProviderAdapter {
  generateCandidate(request: AIGenerateRequest, sourceMaterial?: any): Promise<AICandidateDTO>;
}

export class MockAIAdapter implements AIProviderAdapter {
  async generateCandidate(request: AIGenerateRequest, sourceMaterial?: any): Promise<AICandidateDTO> {
    const isAdaptation = request.taskType === 'ADAPT_MATERIAL' && sourceMaterial;

    const candidateContent = isAdaptation
      ? `${sourceMaterial.title} — Adapted for ${request.targetLevel}\n\n` +
        `Urban farming is growing in popularity across modern cities. Using community rooftops, shared gardens, and energy-efficient vertical layers, local growers can cultivate vegetables and herbs near neighborhoods.\n\n` +
        `This approach reduces transportation costs, lowers carbon emissions, and encourages healthier eating. While it cannot fully replace conventional rural agriculture, it plays a vital role in sustainable city planning.`
      : `Urban Living and Sustainable Green Spaces\n\n` +
        `Modern urban centers are adopting innovative architectural solutions to expand green spaces. From high-rise vertical forests to community rooftop greenhouses, city planners are rethinking traditional infrastructure.\n\n` +
        `These spaces not only improve mental well-being for residents but also contribute to stormwater management and temperature control in dense districts.`;

    const generatedQuestions = [
      {
        prompt: `Based on the passage, what is a primary advantage of urban green spaces?`,
        options: [
          'A. They completely eliminate the need for traditional agriculture',
          'B. They contribute to urban sustainability and lower emissions',
          'C. They are free to construct and maintain',
          'D. They have no impact on city temperatures',
        ],
        correctAnswer: 'B. They contribute to urban sustainability and lower emissions',
        skillName: 'Reading • Inference',
      },
      {
        prompt: `What can be inferred about the future outlook for urban farming?`,
        options: [
          'A. It will remain a niche hobby with little impact',
          'B. It is viewed as an important complementary method for modern cities',
          'C. It will cause severe conflicts with traditional farmers',
          'D. It has been banned by most local municipalities',
        ],
        correctAnswer: 'B. It is viewed as an important complementary method for modern cities',
        skillName: 'Reading • Inference',
      },
    ];

    const vocabularySupport = [
      { term: 'cultivate (v)', definition: 'to prepare and use land for crops' },
      { term: 'sustainable (adj)', definition: 'able to be maintained at a steady level without depleting resources' },
      { term: 'conventional (adj)', definition: 'based on or in accordance with what is generally done' },
    ];

    return {
      id: randomUUID(),
      taskType: request.taskType,
      provider: 'MockProvider',
      model: 'mock-gpt-4o',
      promptSummary: request.instructions,
      sourceMaterialId: sourceMaterial?.id || null,
      sourceMaterialTitle: sourceMaterial?.title,
      sourceContent: sourceMaterial?.content,
      candidateContent,
      targetSkillId: request.targetSkillId,
      targetSkillName: 'Reading • Inference',
      targetLevel: request.targetLevel,
      generatedQuestions,
      vocabularySupport,
      validation: {
        isSchemaValid: true,
        skillMappingPresent: true,
        answerKeyProvided: true,
        requiresTeacherApproval: true,
      },
      status: AIGenerationStatus.UNDER_REVIEW,
      createdAt: new Date().toISOString(),
    };
  }
}

export const aiAdapter: AIProviderAdapter = new MockAIAdapter();
