# NCDev Developer Guide

**Version:** 0.0.1 | **Last Updated:** 2026-03-25

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Building the Plugin](#building-the-plugin)
3. [Code Architecture](#code-architecture)
4. [Adding New Features](#adding-new-features)
5. [Testing](#testing)
6. [Best Practices](#best-practices)

---

## Project Structure

```
ncdev/
├── build.gradle.kts              # Gradle build configuration
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/ncdev/
│   │   │       ├── NcDevPlugin.java           # Main plugin class
│   │   │       ├── api/                      # REST API
│   │   │       │   └── ConfigApiServer.java
│   │   │       ├── cache/                    # In-memory caching
│   │   │       │   └── PlayerCache.java
│   │   │       ├── config/                  # Configuration
│   │   │       │   └── NcDevConfig.java
│   │   │       ├── currency/                # Currency system
│   │   │       │   └── CurrencyService.java
│   │   │       ├── database/                # Database layer
│   │   │       │   └── DatabaseManager.java
│   │   │       ├── economy/                 # Economy operations
│   │   │       │   └── EconomyService.java
│   │   │       ├── lifecycle/               # Data lifecycle
│   │   │       │   └── LifecycleManager.java
│   │   │       ├── marketplace/             # Marketplace
│   │   │       │   └── MarketplaceService.java
│   │   │       ├── moderation/              # Moderation tools
│   │   │       │   └── ModerationService.java
│   │   │       ├── redis/                   # Redis integration
│   │   │       │   └── RedisManager.java
│   │   │       ├── service/                 # Core services
│   │   │       │   ├── PlayerService.java
│   │   │       │   └── PlayerStatsService.java
│   │   │       ├── social/                 # Social features
│   │   │       │   └── SocialService.java
│   │   │       ├── socketio/                # Socket.IO server
│   │   │       │   └── SocketIOManager.java
│   │   │       ├── trading/                 # P2P trading
│   │   │       │   └── TradingService.java
│   │   │       ├── util/                   # Utilities
│   │   │       │   └── JsonLogger.java
│   │   │       ├── websocket/              # WebSocket server
│   │   │       │   └── WebSocketServer.java
│   │   │       └── model/                   # Data models
│   │   └── resources/
│   │       ├── config.yml                  # Default configuration
│   │       └── plugin.yml                  # Plugin metadata
│   └── test/
│       └── java/
│           └── com/ncdev/                  # Test classes
└── README.md
```

---

## Building the Plugin

### Prerequisites

- Java 21 or higher
- Gradle 8.x (or use wrapper)

### Build Commands

```bash
# Full build
./gradlew build

# Build with shadow JAR
./gradlew shadowJar

# Clean build
./gradlew clean build

# Build without tests
./gradlew build -x test

# Run tests
./gradlew test
```

### Output

After build, the JAR will be located at:
```
build/libs/ncdev-0.0.1.jar
```

---

## Code Architecture

### Plugin Initialization Flow

```
1. onEnable()
   ├── loadConfiguration()           # Load YAML config
   ├── detectServerType()            # Paper/Folia/Spigot/Velocity
   ├── initializeAsyncExecutor()     # Thread pool setup
   ├── initializeDatabase()           # Database connection
   ├── initializeRedis()              # Redis (optional)
   ├── initializeServices()          # All services
   ├── initializeRealTimeServers()   # WebSocket/Socket.IO
   ├── registerEventListeners()      # Bukkit events
   └── scheduleBackgroundTasks()     # Periodic tasks
```

### Service Pattern

All services follow a consistent pattern:

```java
public class ExampleService {
    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig config;
    
    public ExampleService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig();
    }
    
    public void method1() {
        // Implementation
    }
    
    public ResultType method2() {
        // Implementation with result
        return new ResultType(...);
    }
}
```

### Configuration Access

```java
// Access plugin config
NcDevConfig config = plugin.getNcDevConfig();

// Access specific section
NcDevConfig.Currency currencyConfig = config.currency();

// Access nested value
boolean enabled = config.marketplace().listings().itemSale().enabled();
```

### Database Operations

```java
// Query
try (Connection conn = db.getConnection()) {
    String sql = "SELECT * FROM table WHERE uuid = ?";
    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
        stmt.setString(1, uuid.toString());
        try (ResultSet rs = stmt.executeQuery()) {
            if (rs.next()) {
                // Process result
            }
        }
    }
}

// Insert/Update
try (Connection conn = db.getConnection()) {
    String sql = "INSERT INTO table (uuid, name, value) VALUES (?, ?, ?)";
    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
        stmt.setString(1, uuid.toString());
        stmt.setString(2, name);
        stmt.setInt(3, value);
        stmt.executeUpdate();
    }
}

// Batch operations
conn.setAutoCommit(false);
try {
    for (Item item : items) {
        stmt.setString(1, item.getUuid());
        stmt.addBatch();
    }
    stmt.executeBatch();
    conn.commit();
} catch (Exception e) {
    conn.rollback();
    throw e;
}
```

### Logging

```java
import static com.ncdev.util.JsonLogger.*;

public class ExampleService {
    public void doSomething() {
        info("action_started", Map.of("key", "value"));
        
        try {
            // Implementation
            info("action_completed", Map.of("result", "success"));
        } catch (Exception e) {
            error("action_failed", Map.of("key", "value"), e);
        }
    }
}
```

---

## Adding New Features

### 1. Create a New Service

```java
package com.ncdev.example;

import com.ncdev.NcDevPlugin;
import com.ncdev.database.DatabaseManager;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;

import java.sql.*;
import java.util.*;

public class ExampleService {
    
    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig.Example config;
    
    public ExampleService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig().example();
    }
    
    public boolean performAction(UUID playerUuid, String param) {
        if (!config.enabled()) {
            return false;
        }
        
        try {
            // Implementation
            return true;
        } catch (Exception e) {
            JsonLogger.error("example_action_failed", 
                Map.of("player", playerUuid.toString()), e);
            return false;
        }
    }
}
```

### 2. Register in Main Plugin

```java
public final class NcDevPlugin extends JavaPlugin implements Listener {
    
    private ExampleService exampleService;
    
    private void initializeServices() {
        this.exampleService = new ExampleService(databaseManager, this);
        JsonLogger.info("services_initialized", Map.of("example", config.example().enabled()));
    }
    
    // Getter for other services
    public ExampleService getExampleService() {
        return exampleService;
    }
}
```

### 3. Add Configuration

In `NcDevConfig.java`, add:

```java
// Add record to ConfigRoot
public record ConfigRoot(
    // ... existing fields
    ExampleConfig example,  // Add this
    // ...
) {}

// Add new config record
public record ExampleConfig(
    boolean enabled,
    String someValue,
    int someNumber
) {}
```

### 4. Add Database Schema

In `DatabaseManager.java`:

```java
private void initializeSchema(Connection conn) throws SQLException {
    // Add to existing statements
    String[] statements = {
        // ... existing tables
        
        // New table
        """
        CREATE TABLE IF NOT EXISTS example_table (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            player_uuid VARCHAR(36),
            value VARCHAR(255),
            created_at TIMESTAMP
        )
        """
    };
    
    for (String sql : statements) {
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.execute();
        }
    }
}
```

### 5. Add Event Listener

```java
public class ExampleEventListener implements Listener {
    
    private final ExampleService exampleService;
    
    public ExampleEventListener(ExampleService exampleService) {
        this.exampleService = exampleService;
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        exampleService.onPlayerJoin(event.getPlayer());
    }
}

// Register in main plugin
getServer().getPluginManager().registerEvents(
    new ExampleEventListener(exampleService), this
);
```

### 6. Add Command Handler

```java
public class ExampleCommand implements CommandExecutor {
    
    private final ExampleService exampleService;
    
    public ExampleCommand(ExampleService exampleService) {
        this.exampleService = exampleService;
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, 
            String label, String[] args) {
        
        if (!sender.hasPermission("ncdev.example")) {
            sender.sendMessage("No permission");
            return true;
        }
        
        if (args.length < 1) {
            sender.sendMessage("Usage: /example <action>");
            return true;
        }
        
        String action = args[0];
        // Handle action
        
        return true;
    }
}

// Register in onEnable
getCommand("example").setExecutor(new ExampleCommand(exampleService));
```

---

## Testing

### Unit Test Structure

```java
package com.ncdev.service;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.currency.CurrencyService;
import com.ncdev.database.DatabaseManager;
import org.junit.jupiter.api.*;
import org.mockito.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CurrencyServiceTest {
    
    @Mock
    private DatabaseManager db;
    
    @Mock
    private NcDevPlugin plugin;
    
    @Mock
    private NcDevConfig config;
    
    @Mock
    private NcDevConfig.Currency currencyConfig;
    
    private CurrencyService currencyService;
    
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        
        when(plugin.getNcDevConfig()).thenReturn(config);
        when(config.currency()).thenReturn(currencyConfig);
        when(currencyConfig.enabled()).thenReturn(true);
        when(currencyConfig.startingBalance()).thenReturn(1000.0);
        when(currencyConfig.minTransaction()).thenReturn(0.01);
        
        currencyService = new CurrencyService(db, plugin);
    }
    
    @Test
    void testInitializePlayerBalance() {
        UUID playerUuid = UUID.randomUUID();
        
        currencyService.initializePlayerBalance(playerUuid);
        
        // Verify database interaction
        verify(db, times(1)).getConnection();
    }
    
    @Test
    void testGetBalance() {
        UUID playerUuid = UUID.randomUUID();
        
        double balance = currencyService.getBalance(playerUuid);
        
        assertEquals(1000.0, balance);
    }
}
```

### Integration Test

```java
package com.ncdev.integration;

import org.junit.jupiter.api.*;

public class MarketplaceIntegrationTest {
    
    @Test
    void testFullPurchaseFlow() {
        // Test complete purchase from listing to completion
    }
}
```

---

## Best Practices

### 1. Error Handling

```java
// Always log errors with context
try {
    // Operation
} catch (SQLException e) {
    JsonLogger.error("operation_failed", 
        Map.of("player", uuid.toString(), "operation", "xyz"), e);
    // Handle gracefully
    return Result.error("Operation failed");
}

// Use try-with-resources
try (Connection conn = db.getConnection();
     PreparedStatement stmt = conn.prepareStatement(sql)) {
    // Operation
} catch (SQLException e) {
    // Handle
}
```

### 2. Thread Safety

```java
// Use concurrent collections
private final Map<UUID, PlayerData> cache = new ConcurrentHashMap<>();
private final Queue<Event> eventQueue = new ConcurrentLinkedQueue<>();

// Use atomic types for counters
private final AtomicInteger counter = new AtomicInteger(0);
```

### 3. Performance

```java
// Batch database operations
try (Connection conn = db.getConnection()) {
    conn.setAutoCommit(false);
    try {
        for (Item item : items) {
            // Batch insert
        }
        conn.commit();
    } catch (Exception e) {
        conn.rollback();
        throw e;
    }
}

// Use async for heavy operations
plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
    // Heavy operation
});
```

### 4. Configuration

```java
// Check if feature is enabled
if (!config.someFeature().enabled()) {
    return;
}

// Validate inputs
if (amount < config.minTransaction()) {
    return Result.error("Amount too low");
}

// Use sensible defaults
int value = config.someValue() > 0 ? config.someValue() : DEFAULT_VALUE;
```

### 5. Logging

```java
// Log important events
info("player_action", Map.of(
    "player", player.getName(),
    "action", "specific_action"
));

// Log with trace ID for debugging
String traceId = UUID.randomUUID().toString();
info("operation_start", Map.of("trace_id", traceId, "..."));

// Log errors with stack trace context
error("operation_failed", Map.of("trace_id", traceId, "..."), exception);
```

---

For more information, visit [docs.ncdev.io](https://docs.ncdev.io)
