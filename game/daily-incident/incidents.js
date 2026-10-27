/**
 * THE DAILY INCIDENT - Incident Database
 * 12 curated, production-grade engineering incidents.
 */

const INCIDENTS = [
  {
    id: "inc-001",
    category: "Database",
    difficulty: "Engineer",
    title: "Checkout requests are timing out",
    description: "Customers report that checkout is extremely slow. Traffic is normal, but HTTP 504 gateway timeouts are spiking across order completion routes.",
    architecture: {
      nodes: [
        { id: "client", label: "Users / Web", type: "client" },
        { id: "gateway", label: "API Gateway", type: "gateway" },
        { id: "order-api", label: "Order API", type: "service" },
        { id: "db", label: "PostgreSQL Primary", type: "database" }
      ],
      edges: [
        { from: "client", to: "gateway" },
        { from: "gateway", to: "order-api" },
        { from: "order-api", to: "db" }
      ]
    },
    initialTelemetry: [
      { label: "RPS", value: "1,420 req/s", status: "normal" },
      { label: "API CPU", value: "42%", status: "normal" },
      { label: "API RAM", value: "51%", status: "normal" },
      { label: "DB Conns", value: "98/100 (98%)", status: "critical" },
      { label: "DB Query Latency", value: "4,200 ms", status: "critical" },
      { label: "Error Rate", value: "8.4%", status: "warning" }
    ],
    investigations: [
      {
        id: "inv-db-logs",
        componentId: "db",
        title: "Inspect DB Connection Pool & Logs",
        cost: 1,
        details: [
          "LOG: org.postgresql.util.PSQLException: Timeout waiting for connection from pool.",
          "Active Connections: 98/100 (All threads waiting on idle connections)",
          "Max lifetime: 30m | Idle timeout: 10m | Connection Leaks: Detected in /v2/checkout endpoint"
        ]
      },
      {
        id: "inv-api-threads",
        componentId: "order-api",
        title: "Analyze API Thread Dumps",
        cost: 1,
        details: [
          "Thread state: 140 threads in WAITING state at CheckoutService.java:84 (orderRepository.saveAndFlush)",
          "CPU utilization remains low because threads are blocked waiting for DB connection release."
        ]
      },
      {
        id: "inv-gateway-routes",
        componentId: "gateway",
        title: "Check API Gateway Latency Breakdown",
        cost: 1,
        details: [
          "Gateway overhead: 4ms",
          "Upstream target (Order API) latency: 5,012ms",
          "Gateway timeout threshold: 5,000ms (Triggers HTTP 504)"
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Database CPU saturation due to unindexed queries", correct: false },
      { id: "h2", text: "Database connection pool exhaustion blocking API threads", correct: true },
      { id: "h3", text: "API Service memory leak causing garbage collection pauses", correct: false },
      { id: "h4", text: "API Gateway rate-limiting incoming customer requests", correct: false }
    ],
    rootCause: "Database Connection Pool Exhaustion",
    explanation: "The application had connection leak bugs in the checkout path. Connections were acquired but unreleased upon certain non-fatal validation errors, leading to complete pool exhaustion while CPU utilization stayed healthy.",
    lesson: "High application CPU is not the only indicator of saturation. A downstream resource such as a database connection pool can become the bottleneck while application CPU remains healthy."
  },
  {
    id: "inc-002",
    category: "Kafka",
    difficulty: "Senior",
    title: "Orders are getting stuck in fulfillment",
    description: "Order creation succeeds immediately, but downstream warehouse fulfillment processing is falling behind by hours.",
    architecture: {
      nodes: [
        { id: "order-api", label: "Order API", type: "service" },
        { id: "kafka", label: "Kafka Event Bus", type: "broker" },
        { id: "worker", label: "Fulfillment Worker", type: "worker" },
        { id: "db", label: "Fulfillment DB", type: "database" }
      ],
      edges: [
        { from: "order-api", to: "kafka" },
        { from: "kafka", to: "worker" },
        { from: "worker", to: "db" }
      ]
    },
    initialTelemetry: [
      { label: "Producer Rate", value: "18,400 msg/s", status: "normal" },
      { label: "Consumer Rate", value: "11,200 msg/s", status: "warning" },
      { label: "Consumer Lag", value: "2,481,923", status: "critical" },
      { label: "Broker CPU", value: "41%", status: "normal" },
      { label: "Partition Health", value: "16/16 HEALTHY", status: "normal" }
    ],
    investigations: [
      {
        id: "inv-kafka-consumer",
        componentId: "kafka",
        title: "Inspect Consumer Group Lag Distribution",
        cost: 1,
        details: [
          "Partition 0-3 Lag: 620,000 msgs each (Assigned to Worker-1)",
          "Partition 4-15 Lag: 0 msgs (Assigned to Worker-2, Worker-3)",
          "Worker-1 process thread state: Stuck in synchronous third-party address verification lock."
        ]
      },
      {
        id: "inv-worker-logs",
        componentId: "worker",
        title: "Check Fulfillment Worker Thread Pool",
        cost: 1,
        details: [
          "Worker-1 error logs: SocketTimeoutException connecting to external AddressVerify API",
          "Max concurrency set to 1 on Partition 0 listener. Processing latency per message: 850ms."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Kafka broker disk I/O bottlenecks dropped partitions", correct: false },
      { id: "h2", text: "Consumer throughput is bottlenecked by single-partition processing lock", correct: true },
      { id: "h3", text: "Kafka producers are publishing corrupted payloads", correct: false },
      { id: "h4", text: "Fulfillment DB locks are deadlocking updates", correct: false }
    ],
    rootCause: "Consumer Throughput Deficit & Uneven Partition Lock",
    explanation: "A blocked thread on a consumer worker stalled partition processing. Producer velocity exceeded processing rate, inflating lag continuously.",
    lesson: "A healthy Kafka broker does not mean a healthy event-driven system. Compare producer throughput, consumer throughput, processing latency, and consumer lag."
  },
  {
    id: "inc-003",
    category: "Kubernetes",
    difficulty: "Engineer",
    title: "Pods are healthy but requests keep failing",
    description: "Ingress routes return 503 Service Unavailable despite Kubernetes showing all Deployment pods in Running state.",
    architecture: {
      nodes: [
        { id: "alb", label: "Load Balancer", type: "gateway" },
        { id: "svc", label: "K8s Service", type: "service" },
        { id: "pods", label: "App Pods (x12)", type: "worker" }
      ],
      edges: [
        { from: "alb", to: "svc" },
        { from: "svc", to: "pods" }
      ]
    },
    initialTelemetry: [
      { label: "Pods Count", value: "12/12 RUNNING", status: "normal" },
      { label: "Pod Restarts", value: "27 total", status: "warning" },
      { label: "Liveness Probe", value: "PASSING (HTTP 200)", status: "normal" },
      { label: "Readiness Probe", value: "FAILING (HTTP 500)", status: "critical" },
      { label: "Endpoints Count", value: "0 Available", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-k8s-events",
        componentId: "svc",
        title: "Inspect K8s Service Endpoints",
        cost: 1,
        details: [
          "kubectl get endpoints app-service -> <none>",
          "Service selector matches pod labels, but endpoints controller removed all IPs due to readiness failure."
        ]
      },
      {
        id: "inv-pod-readiness",
        componentId: "pods",
        title: "Inspect Container Readiness Endpoint",
        cost: 1,
        details: [
          "GET /ready health check failed: 'Redis warm cache initialization incomplete'.",
          "Containers pass liveness (so K8s doesn't restart them), but fail readiness (so traffic is stripped)."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "OOMKilled pods cycling continuous restart loops", correct: false },
      { id: "h2", text: "Failing readiness probe removed pods from Service endpoints", correct: true },
      { id: "h3", text: "K8s Ingress Controller controller pod crash", correct: false },
      { id: "h4", text: "CoreDNS resolving incorrect internal IP mappings", correct: false }
    ],
    rootCause: "Application Readiness Check Failure",
    explanation: "Pods passed liveness probes, keeping them alive, but failed readiness checks due to cache warming errors. Kubernetes correctly removed all pod IPs from the routing endpoints.",
    lesson: "Running pods do not necessarily mean the application is ready to receive traffic."
  },
  {
    id: "inc-004",
    category: "AI / RAG",
    difficulty: "Architect",
    title: "The AI assistant suddenly became confidently wrong",
    description: "The support copilot is hallucinating outdated policy answers despite recent documentation updates.",
    architecture: {
      nodes: [
        { id: "user", label: "User Client", type: "client" },
        { id: "rag", label: "RAG Service", type: "service" },
        { id: "vector", label: "Vector DB", type: "database" },
        { id: "llm", label: "LLM Provider", type: "service" }
      ],
      edges: [
        { from: "user", to: "rag" },
        { from: "rag", to: "vector" },
        { from: "rag", to: "llm" }
      ]
    },
    initialTelemetry: [
      { label: "LLM Latency", value: "840 ms", status: "normal" },
      { label: "Vector Search", value: "14 ms", status: "normal" },
      { label: "Retrieval Score", value: "0.41 (LOW)", status: "critical" },
      { label: "Doc Version", value: "v2.4 (UPDATED)", status: "normal" },
      { label: "Embedding Version", value: "v1.0 (STALE)", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-vector-db",
        componentId: "vector",
        title: "Inspect Vector Index Metadata & Payloads",
        cost: 1,
        details: [
          "Index created: 90 days ago with text-embedding-ada-002.",
          "Document update pipeline committed v2.4 markdown text to raw storage, but failed to trigger re-embedding worker job."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "LLM context window truncation dropping relevant system prompts", correct: false },
      { id: "h2", text: "Documents updated without re-indexing embeddings in Vector DB", correct: true },
      { id: "h3", text: "Vector DB similarity metric changed from Cosine to Euclidean", correct: false },
      { id: "h4", text: "LLM provider model stealth-downgraded to lightweight checkpoint", correct: false }
    ],
    rootCause: "Embedding Index Stale vs. Document Text",
    explanation: "Raw documentation files were updated in CMS, but the vector indexing pipeline was broken. Queries returned vector nearest-neighbors for outdated text chunks.",
    lesson: "In RAG systems, document freshness and embedding freshness must be treated as separate operational concerns."
  },
  {
    id: "inc-005",
    category: "Redis / Cache",
    difficulty: "Senior",
    title: "API latency doubled without a traffic spike",
    description: "Average latency surged from 45ms to 280ms overnight with steady-state user load.",
    architecture: {
      nodes: [
        { id: "api", label: "API Cluster", type: "service" },
        { id: "redis", label: "Redis Cache", type: "database" },
        { id: "db", label: "SQL Cluster", type: "database" }
      ],
      edges: [
        { from: "api", to: "redis" },
        { from: "api", to: "db" }
      ]
    },
    initialTelemetry: [
      { label: "API Load", value: "2,100 RPS", status: "normal" },
      { label: "Redis Memory", value: "1.2 GB / 8 GB", status: "normal" },
      { label: "Redis Hit Rate", value: "12%", status: "critical" },
      { label: "Redis CPU", value: "3%", status: "normal" },
      { label: "App Latency", value: "+220%", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-redis-keys",
        componentId: "redis",
        title: "Inspect Cache Key Patterns & TTL",
        cost: 1,
        details: [
          "Expected Key format: user:profile:{userId}",
          "Actual Key formatted in new release: user:profile:{userId}:{timestamp}",
          "Result: 0% cache hit rate for returning users; every request missed and hit SQL database."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Redis maxmemory eviction policy dropping valid items", correct: false },
      { id: "h2", text: "Cache key format mismatch causing 100% cache misses (Cache Storm)", correct: true },
      { id: "h3", text: "Redis single-threaded event loop blocked by KEYS * command", correct: false },
      { id: "h4", text: "SQL Database table lock on user_profiles table", correct: false }
    ],
    rootCause: "Cache Key Formatting Bug (Cache Miss Storm)",
    explanation: "A recent code deploy accidentally appended a timestamp to cache keys, making every request look unique and bypassing Redis completely.",
    lesson: "A healthy cache infrastructure does not guarantee a healthy caching strategy."
  },
  {
    id: "inc-006",
    category: "CI/CD",
    difficulty: "Engineer",
    title: "Production deployment succeeded. Production is broken.",
    description: "The deployment pipeline green-lighted release v3.1.2, but users immediately hit 500 errors on load.",
    architecture: {
      nodes: [
        { id: "git", label: "GitHub Main", type: "client" },
        { id: "ci", label: "CI Runner", type: "service" },
        { id: "prod", label: "Prod Kubernetes", type: "worker" }
      ],
      edges: [
        { from: "git", to: "ci" },
        { from: "ci", to: "prod" }
      ]
    },
    initialTelemetry: [
      { label: "CI Pipeline", value: "SUCCESS (100%)", status: "normal" },
      { label: "Test Suite", value: "482 PASS / 0 FAIL", status: "normal" },
      { label: "Prod Deploy", value: "COMPLETE", status: "normal" },
      { label: "Prod Error Rate", value: "460% SPIKE", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-env-vars",
        componentId: "prod",
        title: "Compare Staging vs Prod Env Configuration",
        cost: 1,
        details: [
          "Prod Config Missing: PAYMENT_API_SECRET_KEY",
          "Test runner mocks environment variables; CI environment never validated presence of production secret keys."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Flaky integration tests passed false-positives in CI", correct: false },
      { id: "h2", text: "Production configuration missing required environment secret", correct: true },
      { id: "h3", text: "Docker image architecture mismatch (ARM vs x86)", correct: false },
      { id: "h4", text: "Rolling update terminated existing pod connections abruptly", correct: false }
    ],
    rootCause: "Missing Production Environment Configuration",
    explanation: "The build artifact was valid and unit tests passed using mocked values, but production was missing critical runtime environment variables.",
    lesson: "A green pipeline only proves what your pipeline actually validates."
  },
  {
    id: "inc-007",
    category: "API / Microservices",
    difficulty: "Senior",
    title: "One service is healthy. The entire checkout is failing.",
    description: "Checkout service reports high response latency. All microservices show green health checks.",
    architecture: {
      nodes: [
        { id: "checkout", label: "Checkout API", type: "service" },
        { id: "inventory", label: "Inventory Service", type: "service" },
        { id: "tax", label: "Third-Party Tax API", type: "gateway" }
      ],
      edges: [
        { from: "checkout", to: "inventory" },
        { from: "checkout", to: "tax" }
      ]
    },
    initialTelemetry: [
      { label: "Checkout API", value: "HEALTHY", status: "normal" },
      { label: "Inventory Svc", value: "HEALTHY", status: "normal" },
      { label: "Tax API HTTP", value: "HEALTHY (200 OK)", status: "normal" },
      { label: "Tax Latency", value: "8,900 ms", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-tax-timeout",
        componentId: "tax",
        title: "Inspect Synchronous Call Durations",
        cost: 1,
        details: [
          "Checkout API makes synchronous blocking HTTP POST to external Tax API.",
          "Tax API endpoint is not timing out, but taking 8.9s per request. No circuit breaker is configured on Checkout API."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Inventory service DB deadlocks during lock escalation", correct: false },
      { id: "h2", text: "Synchronous external tax dependency latency cascading upstream", correct: true },
      { id: "h3", text: "Checkout API worker memory exhaustion", correct: false },
      { id: "h4", text: "DNS resolution failure for internal microservice hostnames", correct: false }
    ],
    rootCause: "Cascading Latency via Blocking Dependency without Circuit Breaker",
    explanation: "A slow downstream third-party dependency blocked checkout request handler threads because no client-side timeout or circuit breaker was implemented.",
    lesson: "Distributed systems fail across dependency boundaries, not necessarily inside the service showing the error."
  },
  {
    id: "inc-008",
    category: "Cloud",
    difficulty: "Senior",
    title: "Everything is healthy except the requests",
    description: "Cloud status dashboard shows all services in us-east-1 Operational, yet user requests time out intermittent.",
    architecture: {
      nodes: [
        { id: "dns", label: "Route 53 DNS", type: "gateway" },
        { id: "lb", label: "AWS ALB", type: "gateway" },
        { id: "ecs", label: "ECS Cluster", type: "service" }
      ],
      edges: [
        { from: "dns", to: "lb" },
        { from: "lb", to: "ecs" }
      ]
    },
    initialTelemetry: [
      { label: "Cloud Status", value: "ALL GREEN", status: "normal" },
      { label: "ALB Target Health", value: "100% HEALTHY", status: "normal" },
      { label: "Packet Drop", value: "34% in AZ-us-east-1a", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-az-health",
        componentId: "lb",
        title: "Inspect Per-Availability-Zone Metrics",
        cost: 1,
        details: [
          "us-east-1a target nodes returning 100% network timeout on egress.",
          "us-east-1b & us-east-1c operating normally. ALB cross-zone balancing sent 33% traffic to degraded AZ."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "AWS IAM role permission expiry on ECS tasks", correct: false },
      { id: "h2", text: "Single Availability Zone network degradation with ALB cross-zone routing enabled", correct: true },
      { id: "h3", text: "Cloudflare WAF rule dropping valid TLS handshakes", correct: false },
      { id: "h4", text: "ECS auto-scaling group hitting maximum instance quota limit", correct: false }
    ],
    rootCause: "Localized Availability Zone Network Loss",
    explanation: "One AWS AZ suffered network loss. Synthetic health checks on LB targets did not mark nodes unhealthy fast enough, causing 1/3 of requests to fail.",
    lesson: "Application health checks must account for important external dependencies and underlying infrastructure topology."
  },
  {
    id: "inc-009",
    category: "Networking",
    difficulty: "Architect",
    title: "Only some customers can reach the service",
    description: "Users in Europe report connection reset errors, while US users experience no issues.",
    architecture: {
      nodes: [
        { id: "us-user", label: "US Users", type: "client" },
        { id: "eu-user", label: "EU Users", type: "client" },
        { id: "cdn", label: "Anycast CDN / Edge", type: "gateway" },
        { id: "origin", label: "Origin Server", type: "service" }
      ],
      edges: [
        { from: "us-user", to: "cdn" },
        { from: "eu-user", to: "cdn" },
        { from: "cdn", to: "origin" }
      ]
    },
    initialTelemetry: [
      { label: "US Latency", value: "32 ms", status: "normal" },
      { label: "EU Latency", value: "TIMEOUT", status: "critical" },
      { label: "BGP Routing", value: "FLAPPING (EU POP)", status: "warning" },
      { label: "Origin CPU", value: "18%", status: "normal" }
    ],
    investigations: [
      {
        id: "inv-cdn-bgp",
        componentId: "cdn",
        title: "Inspect Edge Point-of-Presence Routing",
        cost: 1,
        details: [
          "Frankfurt Edge POP DNS resolving to revoked IP subnet due to corrupted BGP route advertisement.",
          "Traffic arriving at EU POP dropped at edge firewall before reaching origin."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Origin API rate-limiting European IP addresses", correct: false },
      { id: "h2", text: "Corrupted BGP route advertisement at European CDN Edge Points of Presence", correct: true },
      { id: "h3", text: "SSL certificate domain wildcard mismatch on European TLDs", correct: false },
      { id: "h4", text: "Database read-replica sync lag in EU region", correct: false }
    ],
    rootCause: "Edge BGP Routing Table Corruption",
    explanation: "BGP route announcements for the European Anycast PoP were misconfigured, sending European client traffic to a non-routable blackhole IP.",
    lesson: "Partial failures often point toward routing, DNS, load balancing, or regional infrastructure rather than application logic."
  },
  {
    id: "inc-010",
    category: "Security",
    difficulty: "Senior",
    title: "Requests are suddenly being rejected",
    description: "Internal microservice-to-microservice traffic is throwing HTTP 401 Unauthorized across all worker nodes.",
    architecture: {
      nodes: [
        { id: "auth", label: "Auth Server (Vault)", type: "gateway" },
        { id: "worker", label: "Worker Service", type: "service" },
        { id: "internal-api", label: "Core API", type: "service" }
      ],
      edges: [
        { from: "worker", to: "auth" },
        { from: "worker", to: "internal-api" }
      ]
    },
    initialTelemetry: [
      { label: "Auth Server", value: "ONLINE", status: "normal" },
      { label: "mTLS Handshake", value: "SUCCESS", status: "normal" },
      { label: "JWT Token", value: "EXPIRED", status: "critical" },
      { label: "Clock Drift", value: "+140 seconds", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-ntp-drift",
        componentId: "worker",
        title: "Inspect Worker Server System Clocks & NTP Sync",
        cost: 1,
        details: [
          "NTP daemon daemon failed on worker node pool 2 hours ago.",
          "System clock drifted +140s. JWT tokens issued by worker include 'iat' (issued at) timestamps in the future, causing API to reject them."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Vault secret signing key compromised and revoked", correct: false },
      { id: "h2", text: "System clock drift causing JWT token validation failures", correct: true },
      { id: "h3", text: "Service mesh mTLS CA certificate root expiration", correct: false },
      { id: "h4", text: "Worker service environment missing API private key", correct: false }
    ],
    rootCause: "System Clock Drift Invalidating Cryptographic Tokens",
    explanation: "Worker nodes lost NTP synchronization. The resulting clock drift meant issued tokens had invalid 'issued at' (iat) times relative to the API server.",
    lesson: "Credential rotation and token validation depend heavily on precise network time sync (NTP) across distributed nodes."
  },
  {
    id: "inc-011",
    category: "Distributed Systems",
    difficulty: "Architect",
    title: "The same order appears twice",
    description: "Customers report duplicate credit card charges and duplicate order confirmation emails for single transactions.",
    architecture: {
      nodes: [
        { id: "client", label: "Mobile App", type: "client" },
        { id: "pay-api", label: "Payment API", type: "service" },
        { id: "stripe", label: "Payment Gateway", type: "gateway" },
        { id: "db", label: "Orders DB", type: "database" }
      ],
      edges: [
        { from: "client", to: "pay-api" },
        { from: "pay-api", to: "stripe" },
        { from: "pay-api", to: "db" }
      ]
    },
    initialTelemetry: [
      { label: "API Timeout Rate", value: "4.2%", status: "warning" },
      { label: "Network Retries", value: "ENABLED (3x)", status: "warning" },
      { label: "Idempotency Key", value: "MISSING", status: "critical" },
      { label: "Duplicate Charges", value: "+14%", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-retry-logic",
        componentId: "pay-api",
        title: "Inspect Mobile Client Network Retry Logs",
        cost: 1,
        details: [
          "Mobile Client timeout set to 2,000ms.",
          "Payment Gateway processing takes 2,400ms. Mobile client times out and automatically retries POST /checkout without an Idempotency-Key header."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Database master-slave replication lag inserting duplicate rows", correct: false },
      { id: "h2", text: "Client-side automatic retries without backend idempotency keys", correct: true },
      { id: "h3", text: "Stripe webhook delivering duplicate event webhooks", correct: false },
      { id: "h4", text: "Race condition in payment service thread pool", correct: false }
    ],
    rootCause: "Non-Idempotent Network Retries",
    explanation: "Transient network slowdowns caused the client to time out and retry the payment request. Because the API lacked idempotency keys, each retry processed a new charge.",
    lesson: "Retries improve resilience, but without idempotency they can turn transient failures into duplicate side effects."
  },
  {
    id: "inc-012",
    category: "Observability",
    difficulty: "Architect",
    title: "Production is failing, but every dashboard is green",
    description: "Support ticket volume is surging due to broken logins, yet CloudWatch and Datadog report 100% system availability.",
    architecture: {
      nodes: [
        { id: "user", label: "User Browser", type: "client" },
        { id: "cdn", label: "CDN Edge", type: "gateway" },
        { id: "auth", label: "Auth Endpoint", type: "service" }
      ],
      edges: [
        { from: "user", to: "cdn" },
        { from: "cdn", to: "auth" }
      ]
    },
    initialTelemetry: [
      { label: "HTTP 200 Rate", value: "99.98%", status: "normal" },
      { label: "Server CPU", value: "14%", status: "normal" },
      { label: "Synthetic Checks", value: "PASSING", status: "normal" },
      { label: "User SLI (Actual)", value: "FAILING (HTTP 200 with error payload)", status: "critical" }
    ],
    investigations: [
      {
        id: "inv-synthetic-payload",
        componentId: "auth",
        title: "Inspect Auth Endpoint Response Payloads",
        cost: 1,
        details: [
          "Auth API returns HTTP 200 OK with body: { 'success': false, 'error': 'AUTH_PROVIDER_DOWN' }",
          "Monitoring metric only checks HTTP status code == 200, ignoring JSON payload health state."
        ]
      }
    ],
    hypotheses: [
      { id: "h1", text: "Datadog agent dropped metric collection metrics during network split", correct: false },
      { id: "h2", text: "Monitoring tracks HTTP status codes instead of actual payload success SLIs", correct: true },
      { id: "h3", text: "Synthetic probe pinging cached static maintenance HTML page", correct: false },
      { id: "h4", text: "Log aggregator dropped error logs due to sampling caps", correct: false }
    ],
    rootCause: "Unaligned Metric SLI Monitoring (False Positive 200s)",
    explanation: "The application wrapped operational errors in standard HTTP 200 success codes. Monitoring dashboards registered 100% uptime while users received error payloads.",
    lesson: "You cannot operate what you cannot observe, and infrastructure health is not the same as user experience."
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INCIDENTS };
}