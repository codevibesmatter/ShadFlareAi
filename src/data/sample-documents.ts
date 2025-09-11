export interface Document {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  metadata: {
    author?: string
    createdAt: string
    updatedAt: string
    source?: string
  }
}

export const sampleDocuments: Document[] = [
  {
    id: 'buildmantle-business-model-authority',
    title: 'BuildMantle Revolutionary Housing Business Model',
    content: `BuildMantle operates as a lean, digital-first service company that has reimagined the home building process. The Problem We Solve: Current housing options present significant challenges. You either settle for cookie-cutter mediocrity or pay $800K+ for custom quality. Great design is locked behind massive architect fees. Real comfort and performance are marketing myths.

Our Solution: We're democratizing access to architect-quality design and verified home performance. Beautiful, comfortable homes that actually work - at prices normal people can afford.

Core Value Proposition: "World-class design and real comfort - finally within reach"

How We Do It:
- Design & Engineering: Offshore design teams (primarily Eastern/Central Europe) delivering architect-quality at 90% less cost
- Materials: Complete structural shell package including triple pane European windows, framing, roofing, siding insulation at 25-35% below retail
- Method: Post-frame construction (pole barns) simplifies building with less wood, fewer steel connectors, faster assembly
- Pricing: Transparent pricing model with no hidden fees or hourly rates
- Guidance: Step-by-step educational system with personal remote support through unfamiliar process
- Focus: We perfect the shell (where expertise matters), you control the rest
- Financing: Single-source construction loans in all 50 states, with project costs that align with local appraisals

The Financing Breakthrough: Most custom homes fail financing because they cost $200K+ more than they appraise for. Banks won't lend beyond appraisal value, killing dreams before they start. Our pricing keeps total project costs within local new construction comps, making standard mortgages possible.

Target Market Segments:
1. Millennial Families & Couples (35% of revenue): Ages 28-42, household income $85K-$175K
2. Remote Work Households (25%): Ages 30-45, income $150K-$400K, location-independent
3. Creative Professionals & Entrepreneurs (20%): Ages 32-50, variable income $60K-$200K
4. Income Property Investors (20%): Airbnb/VRBO investors building standout rentals

Financial Model: Complete Package $95-185K total, Average Project $140K with 40% gross margin. Sample 1,400 sq ft breakdown: $119K total ($20K design, $94K materials, $5K support) with $51,850 gross profit (43.6%).

Competitive Advantages:
- 90% cost reduction through digital-first design operations
- 40% materials margin through factory-direct sourcing and post-frame methodology  
- Comprehensive educational support reducing CAC and increasing completion rates
- Asset-light model eliminates capital requirements while enabling 40%+ gross margins`,
    category: 'Housing Innovation',
    tags: ['buildmantle', 'post-frame', 'housing', 'business-model', 'offshore-design'],
    metadata: {
      author: 'BuildMantle Leadership Team',
      createdAt: '2025-08-06T10:00:00Z',
      updatedAt: '2025-08-06T10:00:00Z',
      source: 'BuildMantle MantleCore Knowledge System'
    }
  },
  {
    id: 'post-frame-construction-technical-guide',
    title: 'Advanced Post-Frame Construction for High-Performance Residential Buildings',
    content: `Post-frame construction, evolved from agricultural pole barn techniques, offers significant advantages for residential construction when properly engineered. BuildMantle's advanced post-frame system is optimized for high-performance residential buildings with clear spans up to 40 feet without interior bearing walls.

System Overview Key Advantages:
- Clear Spans: Up to 40' without interior bearing walls
- Foundation Efficiency: 60-70% less concrete than conventional
- Speed: 30-40% faster framing than stick-built
- Flexibility: Larger openings, variable layouts  
- Cost: 15-25% lower structural costs

Foundation System Components:
Embedded Post Foundation: Post holes 48-60" deep (below frost line), 18-24" diameter depending on loads, 3,500 PSI minimum concrete (4,500 PSI preferred), post embedment 1/3 of above-grade height minimum.

Grade Beam Option: 16-24" width depending on loads, 12-18" depth below grade, #5 bars continuous top and bottom reinforcement, monolithic pour with post bases.

Post and Column Design:
Material Specifications: Solid Sawn 6x6 minimum pressure-treated, Glulam 5.125" x 6" minimum for 3-ply, Steel HSS 6x6x1/4" minimum with base plates, spacing 8-12' typical with 16' maximum.

Connection Details: Post-to-Foundation using Simpson CBSQ or equal, Post-to-Beam through-bolts with steel side plates, uplift resistance minimum 10,000 lb capacity, lateral resistance via embedded depth plus grade beam.

High-Performance Integration:
Thermal Envelope: Wall cavity 8-12" deep for insulation, continuous insulation outside of posts, thermal breaks at all steel connections, air barrier continuous at sheathing layer.

Load Path Design:
Gravity Loads: Roof Loads → Trusses → Posts (point loads) → Foundations → Soil bearing
Lateral Loads: Wind/Seismic → Sheathing (diaphragm) → Posts (shear) → Embedded foundation (moment) → Soil (passive pressure)

Design Loads: Wind 115 mph minimum (Vult), Seismic per local requirements, Snow 40 PSF minimum ground snow, Deflection L/240 minimum (L/360 preferred).

Construction Sequencing: Site preparation, foundation and post installation with 7-day cure time, primary roof structure installation, wall girt installation, envelope completion with insulation and air sealing verification.

Cost Analysis shows 30-40% lumber reduction, 60-70% foundation reduction, 30-40% overall labor reduction compared to stick-frame construction.`,
    category: 'Construction Technology',
    tags: ['post-frame', 'structural-engineering', 'construction', 'high-performance', 'residential'],
    metadata: {
      author: 'BuildMantle Engineering Team',
      createdAt: '2025-08-07T10:00:00Z',
      updatedAt: '2025-08-07T10:00:00Z',
      source: 'BuildMantle MantleCore Technical Documentation'
    }
  },
  {
    id: 'site-built-lvl-trusses-research',
    title: 'Site-Built LVL Trusses for Post-Frame Construction Applications',
    content: `Research into site-built laminated veneer lumber (LVL) truss systems for post-frame construction applications. This approach combines the strength and consistency of engineered lumber with the flexibility of field assembly, based on Matt Risinger's "Real Rebuild" project featuring site-built LVL trusses engineered by Whit Smith of Smith Structural Engineers.

Structural Engineering Principles:
Core Truss Mechanics: Two LVL rafters (compression) + one LVL ceiling joist (tension) form a powerful triangle. Ceiling joist resists outward thrust, transferring vertical loads to exterior walls without intermediate supports. All loads transfer through interconnected elements from roof to foundation with critical connections using structural screws between rafters/joists and hurricane ties at wall plates.

Structural Redundancy: Primary connections via structural screws, backup connections via hurricane ties. AdvanTech subfloor creates secondary structural diaphragm across entire attic floor.

Technical Specifications:
Material Properties: LVL Grade 2.0E or higher recommended, Boise Cascade LVL for dimensional stability, moisture content <19% at installation, span capabilities up to 60' clear spans, higher allowable stresses than dimensional lumber.

Connection Systems:
- Primary Fasteners: SPAX POWERLAGS structural screws for high-strength rafter-to-joist and rafter-to-wall connections
- Alternative Fasteners: Simpson SDWS/SDW, FastenMaster ThruLOK/HeadLOK with similar engineering approvals
- Redundant Hardware: Hurricane ties (Simpson H-series) for backup uplift resistance
- Floor Diaphragm: AdvanTech subflooring + polyurethane adhesive creates rigid structural diaphragm

Applications in Post-Frame Construction:
Primary use cases include clear span buildings over 40', heavy snow load regions (>40 psf), agricultural buildings requiring equipment clearance, residential applications with open floor plans. Integration with post-frame system connects directly to post-frame columns, eliminates interior load-bearing walls, allows continuous insulation strategies, simplifies electrical/mechanical routing.

Cost Analysis:
Material Costs: LVL $800-1200 per thousand board feet, Hardware $150-300 per truss, Labor 2-4 hours per truss assembly.
Comparative Economics: 15-25% premium over dimensional lumber trusses, 30-40% savings vs pre-engineered steel, eliminates crane rental for large spans, reduces foundation requirements vs steel.

Advantages Over Alternatives:
vs Pre-Fab Trusses: No transportation size limits, custom spans and geometries, lower delivery costs, field modification capability.
vs Steel Trusses: Lower material costs, easier field modifications, better insulation compatibility, standard carpentry tools.`,
    category: 'Construction Technology',
    tags: ['lvl-trusses', 'post-frame', 'structural-engineering', 'construction', 'site-assembly'],
    metadata: {
      author: 'BuildMantle Technical Research Team',
      createdAt: '2025-08-08T10:00:00Z',
      updatedAt: '2025-08-08T10:00:00Z',
      source: 'BuildMantle MantleCore Research Division'
    }
  },
  {
    id: 'lore-canon-knowledge-architecture',
    title: 'Lore & Canon: Foundational Knowledge Hierarchy for Organizational Alignment',
    content: `Lore and Canon are the two fountainheads of organizational knowledge, providing clear separation between emotional authority and operational specifications for scalable organizational alignment.

Core Concept:
00-LORE/ (Emotional Fountainhead): Pure emotional story - why we exist, what we believe, our vision. Cultural DNA including values, principles, beliefs that drive decisions. Narrative foundation providing the story that inspires and aligns teams. Mission clarity delivering the emotional "why" behind everything we do.

01-CANON/ (Operational Fountainhead): Hard specifications including concrete rules, procedures, standards. Measurable definitions encompassing metrics, criteria, technical specs. Process authority defining how things actually work and get done. Factual foundation providing the operational "what" that defines execution.

Alignment Architecture:
Universal flow from 00-LORE/ (emotional authority) and 01-CANON/ (operational authority) cascading down to all downstream content including 02-strategy/, 03-processes/, 04-technical/, and other categories.

Universal Application:
This structure works for any organization/project because:
1. Clear Separation: Emotion vs Facts never get tangled
2. Foundational Clarity: Two clear sources of truth for different needs
3. Cascade Integrity: Everything derives from known fountainheads
4. Alignment Simplicity: Check against lore (emotional) or canon (operational)  
5. Scalable: Works for teams of 3 or 3000

Implementation Principles:
- Lore documents contain zero specifications or procedures
- Canon documents contain zero emotional narrative or vision
- All other documents must trace their authority back to lore and/or canon
- Cascade detection ensures alignment flows from these two sources
- No orphaned authority - everything has a clear fountainhead

Scaling to Different Scopes:
Organization Level: Company mission, values, culture (Lore) + Company-wide standards, policies, procedures (Canon)
Project Level: Project vision, goals, team principles aligned with org lore + Requirements, acceptance criteria, constraints aligned with org canon
Sprint/Initiative Level: Sprint goal, purpose, definition of success + Specific tasks, measurable outcomes, deadlines

Modern Implementation with AI:
In AI-powered knowledge graph systems, rigid folder structures become unnecessary. Document metadata replaces folder hierarchy with type: lore|canon|implementation, scope: org|project-name|sprint-id, and aligns_to: [parent-lore, parent-canon] fields.

Benefits: Team alignment with clear emotional and operational foundations at every scope, decision making via appropriate fountainhead reference, conflict resolution by tracing disagreements back to source authority, onboarding with culture and execution understanding, scalability growing with organizational complexity.`,
    category: 'Knowledge Management',
    tags: ['lore-canon', 'organizational-alignment', 'knowledge-architecture', 'scaling', 'ai-systems'],
    metadata: {
      author: 'MantleCore Knowledge Architecture Team',
      createdAt: '2025-08-07T10:00:00Z',
      updatedAt: '2025-08-07T10:00:00Z',
      source: 'BuildMantle MantleCore Meta Documentation'
    }
  },
  {
    id: 'buildmantle-core-knowledge-concept',
    title: 'BuildMantle Core Business Knowledge Base and Strategic Positioning',
    content: `BuildMantle revolutionizes the housing market by providing high-performance building shell systems with modern design nationwide. We bridge the gap between expensive custom homes and cookie-cutter production builds, offering superior energy efficiency, comfort, and contemporary aesthetics at 20-40% lower cost than traditional custom home processes.

Core Value Proposition: "Revolutionary Homes That Actually Work - And You Can Actually Afford"

Business Model: Integrated Design + Materials + Support Platform. We provide complete architectural design, coordinated high-performance material packages, and comprehensive construction support through our digital platform. Customers manage construction through qualified contractors or as supported owner-builders.

Performance Promise: 60-80% energy savings compared to typical new construction, delivered through verified building science and comprehensive support systems.

Market Problem:
The housing market is fundamentally broken: Existing homes are outdated, inefficient, expensive to maintain. New production homes offer cookie-cutter designs, poor quality, no customization. Custom homes are prohibitively expensive with lengthy process and unpredictable costs.

Our Solution combines:
1. Modern, customizable design without architect fees
2. High-performance building systems (50-80% energy savings)  
3. Advanced post-frame construction for cost efficiency
4. Transparent pricing and nationwide financing
5. Complete documentation enabling quality construction anywhere

Core Offerings:
Design Services: Unlimited customization modifying proven models or creating fully custom designs, professional documentation with complete permit-ready architectural and engineering plans, modern aesthetics unavailable elsewhere, space efficiency maximizing livability per square foot.

High-Performance Shell Systems: Envelope performance with R-35+ wall insulation (2-3x code minimum), <1.0 ACH50 air tightness (5x better than typical), triple-pane European windows standard. Structural system using advanced post-frame construction enabling 30-40% larger window openings, clear spans up to 40 feet without interior bearing walls, simplified construction reducing labor costs 15-25%.

Target Market Analysis:
Primary segments include Intrepid Millennials (35% focus), Tech Worker Retreat Builders (25%), Creative Class Home Builders (20%), Sustainability Pioneers (15%), Rural Progressives (5%).

Market Sizing: Total Addressable Market 8.9M households, Serviceable Addressable Market 2.2M actively researching alternatives, Serviceable Obtainable Market 10K homes by Year 5 (0.45% market share).

Financial Model shows Design Fees $8-15K per project, Material Package Margins 25-35% markup, Window/Door Sales 40-50% margin on factory-direct European products. Unit Economics per project: Average 2,200 sq ft, Design Revenue $12K, Materials Revenue $308K, Gross Margin $89K (29%), Customer Acquisition Cost $2,500.`,
    category: 'Business Strategy',
    tags: ['buildmantle', 'business-strategy', 'high-performance', 'housing-innovation', 'market-analysis'],
    metadata: {
      author: 'BuildMantle Leadership',
      createdAt: '2025-08-05T10:00:00Z',
      updatedAt: '2025-08-07T10:00:00Z',
      source: 'BuildMantle MantleCore Strategic Planning'
    }
  },
  {
    id: 'mantlecore-knowledge-management-system',
    title: 'MantleCore: GitHub-Based Centralized Knowledge Management with AI Integration',
    content: `MantleCore provides a GitHub-based centralized knowledge management system with automated metadata processing, cross-referencing, and search capabilities. This knowledge management system includes structured directory hierarchy for organizing knowledge, rich metadata schema for document classification, automated cross-reference generation, full-text search with relevance ranking, GitHub Actions automation for continuous processing, analytics and reporting capabilities.

Key Features:
Auto-derivation of deliverables from knowledge documents with master authority alignment system for content consistency. The system uses two AI providers: Google Gemini for embeddings generation (768-dimensional vectors) and OpenRouter for content review and validation using Gemini Flash models.

Architecture Components:
Authority Documents System: The repository uses "authority documents" as single sources of truth located in /knowledge/00-authority/ defining Business Model Authority (core business strategy, pricing, value propositions), Technical Authority (construction methods, performance standards), Process Authority (operational workflows, customer journey), Brand Authority (messaging, voice, communication standards).

Document Workflow Pipeline: Documents move through stages in /knowledge/_work/: 01-ideation/ for single files (date-prefixed new concepts), 02-drafting/ for folders containing draft + supporting files, 03-review/ for folders under stakeholder review, 04-finalization/ for final edits before publishing. Published documents move to main /knowledge/ categories with clean names.

Multi-Factor Relationship Detection: The link_manager.py uses three factors to detect document relationships: Document Similarity (overall embedding similarity), Section Dependency (specific section-level connections), Concept Matching (shared terminology and concepts). Relationships above threshold are automatically added to document frontmatter.

Cascade Impact Detection: When authority documents change, cascade_detector.py identifies all dependent documents, generates specific update tasks, creates checklists for manual review, can output Claude Code-actionable tasks.

Content Derivation System: Automatically generate deliverables (website copy, marketing materials, documentation) from knowledge base using metadata-driven rules. Setting up derivation rules in document frontmatter enables derivation of content types (website copy, blog posts, documentation), assets (datasheets, presentations, infographics), functionality (calculators, tools, interactive content), campaigns (marketing campaigns, email sequences).

Quality Assurance includes automated validation on commits, broken reference detection, document quality metrics, PR validation checks, alignment validation against master sources, authority conflict detection.`,
    category: 'Knowledge Management',
    tags: ['mantlecore', 'knowledge-management', 'ai-integration', 'github-automation', 'content-derivation'],
    metadata: {
      author: 'MantleCore Development Team',
      createdAt: '2025-08-05T10:00:00Z',
      updatedAt: '2025-08-05T10:00:00Z',
      source: 'BuildMantle MantleCore System Documentation'
    }
  }
]