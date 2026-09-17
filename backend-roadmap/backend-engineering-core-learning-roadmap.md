# Backend Engineering Core Learning Roadmap

Transitioning from consuming backend services to engineering them requires shifting focus from data presentation to resource management, concurrency, reliability, and data integrity. This roadmap is designed for self-directed study, requiring engineers to read raw documentation, analyze source code, and build systems from scratch.

## 1. Separation of Concerns & Architectural Abstraction Layers

- **Key Focus:** Layered Architecture, Clean Architecture, Dependency Inversion, and Separation of Concerns.
- **Why It Matters:** Frontend workflows often blend UI and state. On the backend, merging routing, database queries, and business logic into a single file creates brittle, unmaintainable code. Separation of Concerns divides the application into distinct sections, each addressing a specific responsibility.
- **The Layered Mental Model:**
  - **Presentation Layer (API / Controllers):** Captures user requests, exposes HTTP endpoints, and generates responses. Contains zero business or database logic.
  - **Application Layer (Use Cases / Services):** Orchestrates the workflow and business processes. Validates incoming requests and coordinates the movement of data between the Domain Layer and external systems (like databases or APIs). Acts as the "manager" that handles the how, but not the core business math.
  - **Domain Layer (Entities):** The core business "source of truth." Contains the pure business rules, calculations, and invariants that define the system's identity. This layer is completely agnostic of the database, UI, or frameworks, ensuring business logic remains testable and isolated. Note: In some architectural styles (like Active Record), Domain Entities are tightly coupled to the database via ORM decorators. While this simplifies development and synchronization, it prioritizes velocity over strict database independence. Teams should consciously choose between this 'ORM-centric' model and a 'Pure Domain' model based on the complexity and expected lifespan of the application.
  - **Infrastructure Layer (Data Access / Repositories):** Handles all external interactions—database drivers, file systems, and third-party APIs.

## 2. API Design & Versioning

- **Key Focus**: RESTful conventions, GraphQL vs. REST, HATEOAS, API Versioning (Header/URL), Breaking change management.
- **Why It Matters**: An API is a public contract. Once published, it is difficult to change; poor design leads to long-term technical debt and breaking changes for consumers.
- The API Mental Model:
  - **Contract Stability:** Maintaining backward compatibility; versioning allows the backend to evolve while clients migrate at their own pace.
  - **Semantics:** Using standard HTTP status codes and verb conventions to communicate state and intent clearly.
  - **A note on HATEOAS:** Worth understanding conceptually, but low practical priority. Richardson Maturity Level 2 (resources plus HTTP verbs and status codes) is the de facto standard for what the industry calls "RESTful"; full Level 3 hypermedia controls are rare in production, because clients are typically built alongside the API rather than discovering it generically. Zalando's public API guidelines, for instance, mandate Level 2 and treat Level 3 as an optional "MAY" they do not generally recommend. Learn it to recognize it; do not treat it as a bar your APIs must clear.

## 3. Object Instantiation & Design Patterns

- **Key Focus**: Creational (Singleton, Factory, Builder), Structural (Adapter, Facade), and Behavioral (Observer, Strategy) patterns.
- **Why It Matters**: Hardcoded dependencies make unit testing impossible and limit code reuse. Design patterns are established, language-agnostic frameworks that standardize how objects are created and how they interact.
- The Pattern Mental Model:
  - **Creational:** Standardizes how memory is allocated and objects are built (e.g., ensuring only one database client exists via a Singleton). Be precise about what is being made singular here: the thing you share process-wide is the connection *pool* or client object that manages many connections — not a single raw database connection, which would serialize every request behind one socket. See §5.
  - **Structural:** Organizes relationships between objects, allowing complex interfaces to be simplified (e.g., wrapping a complex third-party billing SDK in a simple internal Facade).
  - **Behavioral:** Manages algorithms, communication, and the assignment of responsibilities between objects.

## 4. Data Migrations & Schema Evolution

- **Key Focus:** Online vs. offline migrations, data backfilling, transaction locking during schema changes, handling large data sets, and blue/green deployments.
- **Why It Matters:** Production data is a critical asset. Modifying a table schema on a live database can lock tables, cause downtime, or result in data loss if migrations are not atomic, reversible, and designed to coexist with running application code.
- **The Migration Mental Model:**
  - **Backfilling:** When adding a new column, existing rows must be populated safely. Large datasets require batching to prevent transaction log bloat and performance degradation.
  - **Zero-Downtime:** Implementing migrations that are backward-compatible, ensuring the application remains functional for both old and new code versions during deployment.
  - **Safety & Rollback:** Every migration must include a verified "down" or undo script. Using idempotent migration tools ensures the database state remains consistent even if an error occurs during execution.

## 5. Database Connection Lifecycle & Resource Management

- **Key Focus**: Connection pooling, socket exhaustion, execution timeouts, thread safety, and memory management.
- **Why It Matters**: The backend does not run in isolation; it shares finite server resources (RAM, CPU, network sockets) across thousands of simultaneous users. Failing to manage database sockets leads to catastrophic cascading failures.
- The Resource Mental Model:
  - **The Pool:** Establishing a database connection is computationally expensive. Connection pooling keeps a set of "warm" open connections ready for reuse.
  - **The Queue:** When the pool is empty, incoming requests must wait in a queue. If the queue time exceeds the HTTP timeout limit, the request drops.
  - **The Leak:** If code executes a query but fails to explicitly release the connection back to the pool, the pool eventually drains to zero, locking the entire application.

## 6. Concurrency, Race Conditions & Locking Strategies

- **Key Focus**: Optimistic vs. Pessimistic Locking, Distributed Locks, Database Locking Mechanisms, Transaction Isolation Levels.
- **Why It Matters**: Without structural safeguards, concurrent requests will read stale data and overwrite each other, causing silent financial or data corruption.
- The Concurrency Mental Model:
  - **Optimistic Locking:** Assumes conflict is rare. Validates state right before writing (e.g., updating only if `version = 1`). Fails and retries if the state changed.
  - **Pessimistic Locking:** Assumes conflict is guaranteed. Locks the row immediately upon reading (`SELECT FOR UPDATE`), forcing other *lockers and writers* to wait until the transaction commits. Note: under MVCC (PostgreSQL, MySQL/InnoDB) this does **not** block plain `SELECT`s — readers never block writers and writers never block readers. Only conflicting locking reads (`FOR UPDATE` / `FOR SHARE`) and `UPDATE`/`DELETE` on the locked rows wait.
  - **Distributed Locking:** Coordinates locks across multiple physical servers. Match the tool to the stakes: for *correctness* locks, use a consensus-backed store (etcd, ZooKeeper) and issue **fencing tokens** — a monotonically increasing number the resource checks — so a paused or delayed client cannot act on a lock it has already lost. Redis is not a consensus store; the Redlock algorithm provides no fencing tokens and relies on clock and timing assumptions, so it is suitable for *efficiency* locks (de-duplicating cron runs, preventing cache stampedes) rather than data-safety-critical ones.

## 7. Advanced Data Modeling & Storage Patterns

- **Key Focus**: Relational Normalization, Entity-Attribute-Value (EAV), Single-Table Design, Outbox Pattern, Sharding.
- **Why It Matters**: Structure dictates performance. A database schema optimized for analytics queries will crash under high-velocity transactional writes.
- The Data Storage Mental Model:
  - **Normalization:** Prioritizes strict data integrity and reduces duplication by spreading data across many joined tables.
  - **Denormalization (Read-Optimized):** Pre-computes and duplicates data to minimize complex joins, optimizing for extreme read speeds at the expense of write complexity.
  - **Distributed Consistency:** In distributed systems, writing to a database and firing an event (like sending an email) cannot be guaranteed in one step unless patterns like the Outbox Pattern are utilized to enforce atomicity. Understand the limit of that guarantee: the Outbox gives **at-least-once** delivery, not exactly-once. A relay can publish a message and then crash before recording that it did, and on restart it publishes again. The Outbox guarantees an event is never silently lost on the producing side; the consuming side must be idempotent (de-duplicating on an event ID or idempotency key) so a redelivered event is never processed twice. See §11, Idempotency.

## 8. Background Jobs & Worker Systems

- **Key Focus**: Queue backends (Redis/RabbitMQ/SQS), Worker pools, Job retries, Dead-letter queues (DLQs), Job idempotency.
- **Why It Matters**: Backend systems must handle heavy, asynchronous operations without blocking user requests. Job queues decouple the request cycle from heavy compute, allowing for graceful retries and distributed execution.
- The Worker Mental Model:
  - **The Queue:** A persistent buffer that stores tasks; decouples the "Producer" (API) from the "Consumer" (Worker).
  - **Retry Logic:** Automatic handling of transient network/database errors; jobs are re-queued with backoff strategies.
  - **Dead-Letter Queues (DLQ):** A holding area for permanently failed jobs, preventing "poison pills" from blocking the system.

## 9. Caching Strategies & Performance

- **Key Focus**: Cache-aside vs. Write-through, TTL (Time-To-Live), Cache invalidation, Handling "Cache Stampede", Distributed caching (Redis/Memcached).
- **Why It Matters**: Databases are IO-bound and often the primary bottleneck. Caching moves hot data closer to the application, providing orders-of-magnitude performance gains.
- The Caching Mental Model:
  - **TTL:** Defines the lifespan of cached data; balancing freshness against performance.
  - **Invalidation:** The act of purging stale cache entries; ensuring users don't see outdated data.
  - **Stampede Prevention:** Locking mechanisms to ensure only one worker re-populates a cache entry when it expires.

## 10. Observability, Logging & Tracing

- **Key Focus**: Structured logging, Distributed tracing, Metrics (CPU/Latency/Error rates), Alerting, Health checks.
- **Why It Matters**: A system is only as debuggable as its telemetry. Without visibility, production failures are opaque, making root cause analysis impossible.
- The Observability Mental Model:
  - **Logging:** Emitting structured, searchable data about application state changes.
  - **Metrics:** High-level aggregation (e.g., Request Rate, Error Rate, Duration) used for alerting.
  - **Tracing:** Tracking the lifecycle of a request as it hops through services, databases, and message queues.

## 11. Distributed Systems & Architectural Principles

- **Key Focus**: CAP Theorem (Consistency vs. Availability), Event-Driven Architecture, Caching Strategies, Message Queues.
- **Why It Matters**: Once an application scales beyond a single server, network unreliability becomes a constant factor.
- The Distributed Systems Mental Model:
  - **CAP Theorem:** Often mis-stated as "pick any two." In a real distributed system, Partition Tolerance is not optional — networks drop packets and links fail, so partitions will happen. The actual decision is what the system does *during* a partition: a **CP** system rejects unsafe operations to protect its invariants, and an **AP** system keeps serving and accepts stale reads plus later reconciliation. ("CA" describes a single-node system, or a distributed one ignoring a real failure mode.) Two traps in the terminology: CAP *availability* is not uptime — a system can have excellent uptime and still choose consistency by erroring during a partition — and CAP *consistency* is not ACID's C; it is closer to linearizability. The choice is also frequently per-operation and tunable, not a permanent label on a database.
  - **Idempotency:** Because networks drop, clients will retry requests. APIs must be idempotent—meaning the same request can run 10 times safely, but the system only executes the underlying state change once.
  - **Asynchronous Processing:** Long-running tasks (like generating a PDF) should immediately return a `202 Accepted` status and offload the actual work to a background message queue.
