const fetch = require('node-fetch');

// Supported Gemini models
const SUPPORTED_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-exp-1206',
  'gemini-2.0-flash-thinking-exp-1219',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // GET request to list available models
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        models: SUPPORTED_MODELS,
        defaultModel: 'gemini-2.0-flash-exp'
      })
    };
  }

  // Only allow POST requests for generation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { image, prompt, model = 'gemini-2.0-flash-exp', models } = JSON.parse(event.body);
    
    // Validate input
    if (!image || !prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: image and prompt' })
      };
    }

    // Get API key from environment variable
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured. Please contact administrator.' })
      };
    }

    // Determine which models to use
    const modelsToUse = models && Array.isArray(models) && models.length > 0 
      ? models.filter(m => SUPPORTED_MODELS.includes(m))
      : [model];

    // Validate selected models
    const invalidModels = modelsToUse.filter(m => !SUPPORTED_MODELS.includes(m));
    if (invalidModels.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid model(s) specified',
          invalidModels,
          supportedModels: SUPPORTED_MODELS
        })
      };
    }

    console.log('Calling Gemini API with models:', modelsToUse);

    // Call Gemini API for each model
    const results = await Promise.allSettled(
      modelsToUse.map(async (modelName) => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: image
                    }
                  }
                ]
              }]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Gemini API request failed');
        }

        return {
          model: modelName,
          response: data
        };
      })
    );

    // Process results
    const responses = [];
    const errors = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        errors.push({
          model: modelsToUse[index],
          error: result.reason.message
        });
      }
    });

    console.log(`Success: ${responses.length}/${modelsToUse.length} models`);

    // Return results
    if (responses.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'All models failed',
          errors 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results: responses,
        ...(errors.length > 0 && { errors })
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        type: error.name
      })
    };
  }
};
