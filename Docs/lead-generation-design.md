# Lead Generation System Design for EVA Assistant

## Overview
The Lead Generation System is a specialized agent within the EVA Assistant designed to identify, qualify, and store potential recruitment leads for financial advisors. It leverages Firecrawl for web scraping and Google Gemini AI for intelligent processing and qualification.

## Architecture
- **Integration Point**: Extends the existing multi-agent system in `frontend/src/lib/agents/`.
- **Main Class**: `EnhancedLeadGenerationAgent` in `frontend/src/lib/agents/enhanced-lead-generation.ts`.
- **Dependencies**:
  - Firecrawl SDK for web searching and scraping.
  - Google Generative AI for lead qualification.
  - Supabase for storing qualified leads in `organizations`, `lead_scores`, and `candidates` tables.

## Key Components
1. **Lead Discovery**:
   - Takes `LeadCriteria` input (industry, location, titles, etc.).
   - Performs multi-phase searches using Firecrawl's search API.
   - Phases include industry landscape, decision makers, competitive intel, and financial advisors search.

2. **Data Extraction**:
   - Extracts structured data from search results using Firecrawl's extract feature.
   - Schemas for companies, executives, opportunities, and firms.

3. **Enrichment**:
   - Simulates LinkedIn enrichment by cross-referencing extracted data.
   - Future: Integrate actual LinkedIn API.

4. **Qualification**:
   - Uses Gemini AI to score leads based on criteria.
   - Generates insights, recommended approach, and best contact time.

5. **Storage**:
   - Upserts organizations and candidates in Supabase.
   - Inserts lead scores with metadata.

## Workflow
1. User provides lead criteria via UI or API.
2. Agent performs multi-phase search.
3. Extracts and enriches data.
4. Qualifies leads using AI.
5. Stores high-quality leads (score >=60) in database.
6. Returns sorted list of qualified leads.

## Integration with EVA
- Called from OutreachCampaignAgent or directly from dashboard.
- Uses existing A2A orchestrator for coordination with other agents (e.g., email agent for follow-up).

## Error Handling
- Fallback to basic qualification if AI fails.
- Logging of errors during search and storage.

## Future Enhancements
- Real LinkedIn API integration.
- Automated outreach triggering.
- Lead nurturing workflows.

This design builds on the existing agent architecture, ensuring seamless integration with EVA's multi-agent system." 