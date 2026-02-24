/**
 * CogneeClient wraps REST API calls to Cognee server
 */

/** Custom error for Cognee unavailability */
export class CogneeUnavailableError extends Error {
  constructor(message: string = 'Cognee service is unavailable') {
    super(message);
    this.name = 'CogneeUnavailableError';
  }
}

/** Custom error for Cognee API errors */
export class CogneeAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CogneeAPIError';
    this.status = status;
  }
}

export interface SearchResult {
  content: string;
  metadata?: Record<string, any>;
}

export interface Dataset {
  id: string;
  name: string;
  created_at?: string;
  owner_id?: string;
}

export interface AddResponse {
  success: boolean;
  message?: string;
}

export class CogneeClient {
  private baseUrl: string;
  private apiToken?: string;

  constructor(baseUrl: string, apiToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  /**
   * Add data to Cognee with optional NodeSet tags
   * POST /api/v1/add (uses multipart form data)
   * 
   * @param content - Text content to add
   * @param datasetName - Dataset name (default: 'default_user')
   * @param nodeSets - Optional array of NodeSet tags for organizing data
   */
  async addMemory(
    content: string,
    datasetName: string = 'default_user',
    nodeSets?: string[]
  ): Promise<AddResponse> {
    // Create a Blob from the content to simulate a file upload
    const blob = new Blob([content], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('data', blob, 'memory.txt');
    formData.append('datasetName', datasetName);
    
    // Add NodeSet tags if provided
    if (nodeSets && nodeSets.length > 0) {
      for (const nodeSet of nodeSets) {
        formData.append('node_set', nodeSet);
      }
    }

    const headers: Record<string, string> = {};
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    // Don't set Content-Type - let fetch set it with boundary for multipart

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/add`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (error) {
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee add failed: ${errorText}`, response.status);
    }

    return { success: true };
  }

  /**
   * Process data into knowledge graph with optional custom ontology and temporal mode
   * POST /api/v1/cognify
   * 
   * @param datasetName - Dataset to process
   * @param options - Cognify options
   * @param options.useCustomOntology - Use custom memory ontology for categorization
   * @param options.temporalCognify - Enable temporal mode for time-aware queries
   */
  async cognify(
    datasetName: string = 'default_user',
    options: { useCustomOntology?: boolean; temporalCognify?: boolean } = {}
  ): Promise<AddResponse> {
    const { useCustomOntology = false, temporalCognify = true } = options;
    
    const body: Record<string, any> = {
      datasets: [datasetName],
    };

    // Enable temporal cognify for time-aware knowledge extraction
    if (temporalCognify) {
      body.temporal_cognify = true;
    }

    // Use custom memory ontology for structured categorization
    // Note: Custom ontology and temporal mode may be mutually exclusive
    if (useCustomOntology && !temporalCognify) {
      body.graph_model_file = '/home/default_user/cognee/opencode-cognee/memory_ontology.py';
      body.graph_model_name = 'CategorizedMemory';
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/cognify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee cognify failed: ${errorText}`, response.status);
    }

    return { success: true };
  }

  /**
   * Search memories using Cognee's search API
   * POST /api/v1/search
   * 
   * @param query - Search query
   * @param searchType - Type of search: GRAPH_COMPLETION, TEMPORAL, CHUNKS, etc.
   * @param topK - Number of results to return
   * @param sessionId - Optional session ID for conversational context
   */
  async searchMemories(
    query: string,
    searchType: string = 'CHUNKS',  // Default to fast CHUNKS instead of slow GRAPH_COMPLETION
    topK: number = 5,
    sessionId?: string,
    timeoutMs: number = 3000  // Aggressive timeout
  ): Promise<SearchResult[]> {
    const body: Record<string, any> = {
      query: query,
      search_type: searchType,
      top_k: topK,
    };
    
    // Add session_id for conversational context if provided
    if (sessionId) {
      body.session_id = sessionId;
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      response = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new CogneeUnavailableError('Cognee search timed out');
      }
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee search failed: ${errorText}`, response.status);
    }

    const data = await response.json();
    return this.extractSearchResults(data);
  }

  /**
   * List datasets in Cognee
   * GET /api/v1/datasets
   */
  async listDatasets(): Promise<Dataset[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/datasets`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee list datasets failed: ${errorText}`, response.status);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get dataset data
   * GET /api/v1/datasets/{dataset_id}/data
   */
  async getDatasetData(datasetId: string): Promise<any[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/datasets/${datasetId}/data`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee get dataset data failed: ${errorText}`, response.status);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Check dataset processing status
   * GET /api/v1/datasets/status
   */
  async getStatus(): Promise<any> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/datasets/status`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new CogneeUnavailableError('Cannot connect to Cognee server');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new CogneeAPIError(`Cognee status failed: ${errorText}`, response.status);
    }

    return await response.json();
  }

  /**
   * Extract search results from API response
   */
  private extractSearchResults(data: any): SearchResult[] {
    const results: SearchResult[] = [];

    // Handle different response formats
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string') {
          results.push({ content: item });
        } else if (item.content || item.text || item.result) {
          results.push({
            content: item.content || item.text || item.result,
            metadata: item.metadata || item,
          });
        }
      }
    } else if (typeof data === 'string') {
      results.push({ content: data });
    } else if (data.results && Array.isArray(data.results)) {
      return this.extractSearchResults(data.results);
    }

    return results;
  }

  /**
   * Check if Cognee server is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
