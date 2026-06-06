import { config } from '../config.js';
import { AppError } from '../errors/appError.js';
import {
  pythonExtractionResponseSchema,
  type PythonExtractionResponse,
} from '../schemas/pythonExtractionSchema.js';

const AI_SERVICE_UNAVAILABLE_MESSAGE =
  'The note could not be analyzed because the AI service is unavailable.';

const INVALID_AI_RESPONSE_MESSAGE =
  'The AI service returned an invalid response. No data was saved.';

export async function extractActions(
  text: string,
  referenceDate: string,
): Promise<PythonExtractionResponse> {
  const url = `${config.aiServiceUrl}/extract-actions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_date: referenceDate,
      }),
      signal: AbortSignal.timeout(config.aiServiceTimeoutMs),
    });

    if (!response.ok) {
      throw new AppError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        AI_SERVICE_UNAVAILABLE_MESSAGE,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AppError(
        502,
        'INVALID_AI_RESPONSE',
        INVALID_AI_RESPONSE_MESSAGE,
      );
    }

    const parsed = pythonExtractionResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_AI_RESPONSE',
        INVALID_AI_RESPONSE_MESSAGE,
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      'AI_SERVICE_UNAVAILABLE',
      AI_SERVICE_UNAVAILABLE_MESSAGE,
    );
  }
}
