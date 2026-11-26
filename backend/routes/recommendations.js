import { Router } from 'express';
import OpenAI from 'openai';
import EnergyReading from '../models/EnergyReading.js';

const MODEL = 'gpt-6-luna';

const recommendationSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: { type: 'string' },
        status: { type: 'string', enum: ['excellent', 'good', 'moderate', 'high'] },
        recommendations: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    impact: { type: 'string', enum: ['low', 'medium', 'high'] },
                    target_appliance: { type: 'string' }
                },
                required: ['title', 'description', 'impact', 'target_appliance']
            }
        }
    },
    required: ['summary', 'status', 'recommendations']
};

function normalizeReading(input) {
    const kwh = Number(input?.kwh);
    if (!Number.isFinite(kwh) || kwh < 0) {
        return null;
    }

    const estimatedCost = input.estimatedCost === undefined
        ? 0
        : Number(input.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
        return null;
    }

    const peakHours = Array.isArray(input.peakHours)
        ? input.peakHours.filter((hour) => typeof hour === 'string').slice(0, 24)
        : [];
    const appliances = Array.isArray(input.appliances)
        ? input.appliances.slice(0, 30).map((appliance) => ({
            name: String(appliance?.name || 'Unknown appliance').slice(0, 100),
            kwh: Number.isFinite(Number(appliance?.kwh)) && Number(appliance.kwh) >= 0
                ? Number(appliance.kwh)
                : 0,
            estimatedCost: Number.isFinite(Number(appliance?.estimatedCost)) && Number(appliance.estimatedCost) >= 0
                ? Number(appliance.estimatedCost)
                : 0
        }))
        : [];
    const timestamp = new Date(input.timestamp || Date.now());

    return {
        kwh,
        estimatedCost,
        peakHours,
        appliances,
        timestamp: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString()
    };
}

function isValidRecommendationResult(result) {
    return result &&
        typeof result.summary === 'string' &&
        ['excellent', 'good', 'moderate', 'high'].includes(result.status) &&
        Array.isArray(result.recommendations) &&
        result.recommendations.every((item) =>
            item &&
            typeof item.title === 'string' &&
            typeof item.description === 'string' &&
            ['low', 'medium', 'high'].includes(item.impact) &&
            typeof item.target_appliance === 'string'
        );
}

export function createRecommendationsRouter(apiKey) {
    const router = Router();
    const openai = new OpenAI({ apiKey });

    router.post('/', async (req, res, next) => {
        try {
            const providedReading = req.body?.reading ??
                (Object.hasOwn(req.body || {}, 'kwh') ? req.body : null);
    
            let reading;
            if (providedReading) {
                reading = normalizeReading(providedReading);
                if (!reading) {
                    return res.status(400).json({
                        error: 'Energy data must include a non-negative kWh value.'
                    });
            }
        } else {
            const latestReading = await EnergyReading.findOne()
                .sort({ timestamp: -1 })
                .lean();
            if (!latestReading) {
                return res.status(404).json({
                    error: 'No energy reading is available yet. Add a reading to generate recommendations.'
                });
            }
            reading = normalizeReading(latestReading);
        }

        const completion = await openai.chat.completions.create({
            model: MODEL,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'energy_saving_recommendations',
                    strict: true,
                    schema: recommendationSchema
                }
            },
            messages: [
                {
                    role: 'system',
                    content: 'You are an energy efficiency advisor. Give practical, safe, concise recommendations grounded only in the supplied energy reading. Do not invent appliance measurements or guaranteed savings. Return a status of excellent, good, moderate, or high based on usage context. Return 2 to 4 useful actions; target_appliance should name an appliance or use "Household" when general.'
                },
                {
                    role: 'user',
                    content: JSON.stringify(reading)
                }
            ]
        });

        const output = completion.choices[0]?.message?.content;
        if (!output || completion.choices[0]?.message?.refusal) {
            return res.status(502).json({ error: 'Recommendations could not be generated right now.' });
        }

        const result = JSON.parse(output);
        if (!isValidRecommendationResult(result)) {
            return res.status(502).json({ error: 'Recommendations could not be generated right now.' });
        }

        res.json(result);
    } catch (error) {
        if (error?.status === 401 || error?.code === 'invalid_api_key') {
            return res.status(503).json({
                code: 'AI_CONFIGURATION_ERROR',
                error: 'AI recommendations are unavailable because the configured OpenAI API key is invalid. Update OPENAI_API_KEY in .env and restart the backend.'
            });
        }

        console.error(`[ai] Recommendation request failed: ${error.name || 'UnknownError'}`);
        next(Object.assign(new Error('Recommendations could not be generated right now.'), {
            statusCode: 502,
            expose: true
        }));
    }
    });

    return router;
}
