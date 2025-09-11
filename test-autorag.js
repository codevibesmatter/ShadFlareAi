// Test script for AutoRAG functionality
// This demonstrates how AutoRAG will work when deployed to Cloudflare Workers

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Check if AutoRAG binding is available
    if (!env.AUTORAG) {
      return new Response(JSON.stringify({
        error: "AutoRAG binding not available",
        message: "The AUTORAG binding is not configured in wrangler.toml or not available in this environment"
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      if (url.pathname === '/test-search') {
        // Test AutoRAG search
        const query = url.searchParams.get('q') || 'BuildMantle business model';
        
        const searchResults = await env.AUTORAG.search(query, {
          limit: 5,
          threshold: 0.7
        });

        return new Response(JSON.stringify({
          success: true,
          query,
          results: searchResults,
          count: searchResults.length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } else if (url.pathname === '/test-ai-search') {
        // Test AutoRAG AI search with generation
        const query = url.searchParams.get('q') || 'What is BuildMantle and how does their business model work?';
        
        const aiResponse = await env.AUTORAG.aiSearch({
          query,
          model: 'gemini-2.5-flash-lite',
          maxTokens: 2048,
          temperature: 0.1
        });

        return new Response(JSON.stringify({
          success: true,
          query,
          response: aiResponse
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } else if (url.pathname === '/test-status') {
        // Test getting AutoRAG status
        const info = {
          binding_available: true,
          store_name: 'buildmantletest',
          r2_source: 'buildmantle-rag-documents'
        };

        return new Response(JSON.stringify({
          success: true,
          info
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } else {
        return new Response(JSON.stringify({
          message: "AutoRAG Test Endpoints",
          endpoints: [
            "/test-search?q=your_query - Test semantic search",
            "/test-ai-search?q=your_query - Test AI search with response generation",
            "/test-status - Check AutoRAG status"
          ]
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: "AutoRAG operation failed",
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};