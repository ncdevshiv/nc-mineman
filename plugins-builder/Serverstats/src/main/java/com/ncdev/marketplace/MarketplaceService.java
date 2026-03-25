package com.ncdev.marketplace;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.currency.CurrencyService;
import com.ncdev.database.DatabaseManager;
import com.ncdev.socketio.SocketIOManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Marketplace service for buying, selling, and auctioning items.
 */
public class MarketplaceService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig.Marketplace config;
    private final NcDevConfig.Listings listingsConfig;
    
    // Cache active listings
    private final Map<Long, Listing> activeListingsCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60000; // 1 minute

    public MarketplaceService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig().marketplace();
        this.listingsConfig = config.listings();
    }

    /**
     * Create a new listing (direct sale)
     */
    public CreateListingResult createListing(Player seller, ItemStack item, double price, String category) {
        if (!listingsConfig.itemSale().enabled()) {
            return new CreateListingResult(false, null, "Item sales are disabled");
        }
        
        if (item == null || item.getType().isAir()) {
            return new CreateListingResult(false, null, "Invalid item");
        }
        
        if (price < listingsConfig.itemSale().minPrice() || price > listingsConfig.itemSale().maxPrice()) {
            return new CreateListingResult(false, null, 
                    "Price must be between " + listingsConfig.itemSale().minPrice() + 
                    " and " + listingsConfig.itemSale().maxPrice());
        }
        
        // Check player's listing count
        int currentListings = getPlayerListingCount(seller.getUniqueId());
        if (currentListings >= listingsConfig.itemSale().maxPerPlayer()) {
            return new CreateListingResult(false, null, 
                    "Maximum listings reached (" + listingsConfig.itemSale().maxPerPlayer() + ")");
        }
        
        // Calculate tax
        double tax = price * (listingsConfig.itemSale().taxPercent() / 100.0);
        
        // Remove item from player
        if (!seller.getInventory().containsAtLeast(item, item.getAmount())) {
            return new CreateListingResult(false, null, "You don't have this item");
        }
        
        seller.getInventory().removeItem(item);
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO marketplace_listings 
                (seller_uuid, seller_name, listing_type, item_type, item_data, amount, price, category, status, created_at, expires_at)
                VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?, 'active', ?, ?)
                """;
            
            Instant expires = Instant.now().plusSeconds(listingsConfig.itemSale().durationDays() * 24 * 60 * 60L);
            
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, seller.getUniqueId().toString());
                stmt.setString(2, seller.getName());
                stmt.setString(3, item.getType().name());
                stmt.setString(4, plugin.GSON.toJson(serializeItem(item)));
                stmt.setInt(5, item.getAmount());
                stmt.setDouble(6, price);
                stmt.setString(7, category != null ? category : "All");
                stmt.setTimestamp(8, Timestamp.from(Instant.now()));
                stmt.setTimestamp(9, Timestamp.from(expires));
                
                stmt.executeUpdate();
                
                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        long listingId = rs.getLong(1);
                        
                        // Add to cache
                        Listing listing = new Listing(
                                listingId, seller.getUniqueId(), seller.getName(),
                                "SALE", item.getType().name(), item.getAmount(),
                                price, category, expires, "active"
                        );
                        activeListingsCache.put(listingId, listing);
                        
                        // Broadcast update
                        broadcastListingUpdate("created", listing);
                        
                        JsonLogger.info("listing_created", Map.of(
                                "listing_id", listingId,
                                "seller", seller.getName(),
                                "item", item.getType().name(),
                                "price", price
                        ));
                        
                        return new CreateListingResult(true, listingId, "Listing created!");
                    }
                }
            }
        } catch (SQLException e) {
            // Refund item
            seller.getInventory().addItem(item);
            
            JsonLogger.error("listing_create_failed", Map.of(
                    "seller", seller.getName()
            ), e);
        }
        
        return new CreateListingResult(false, null, "Failed to create listing");
    }

    /**
     * Create an auction listing
     */
    public CreateListingResult createAuction(Player seller, ItemStack item, double startingBid, 
            int durationHours, Double buyoutPrice, String category) {
        
        if (!listingsConfig.auction().enabled()) {
            return new CreateListingResult(false, null, "Auctions are disabled");
        }
        
        if (item == null || item.getType().isAir()) {
            return new CreateListingResult(false, null, "Invalid item");
        }
        
        if (startingBid < listingsConfig.auction().minStartingBid()) {
            return new CreateListingResult(false, null, 
                    "Starting bid must be at least " + listingsConfig.auction().minStartingBid());
        }
        
        if (durationHours < listingsConfig.auction().minDurationHours() || 
            durationHours > listingsConfig.auction().maxDurationHours()) {
            return new CreateListingResult(false, null, 
                    "Duration must be between " + listingsConfig.auction().minDurationHours() + 
                    " and " + listingsConfig.auction().maxDurationHours() + " hours");
        }
        
        // Remove item from player
        if (!seller.getInventory().containsAtLeast(item, item.getAmount())) {
            return new CreateListingResult(false, null, "You don't have this item");
        }
        
        seller.getInventory().removeItem(item);
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO marketplace_listings 
                (seller_uuid, seller_name, listing_type, item_type, item_data, amount, price, buyout_price, category, status, created_at, expires_at)
                VALUES (?, ?, 'AUCTION', ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                """;
            
            Instant expires = Instant.now().plusSeconds(durationHours * 60 * 60L);
            
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, seller.getUniqueId().toString());
                stmt.setString(2, seller.getName());
                stmt.setString(3, item.getType().name());
                stmt.setString(4, plugin.GSON.toJson(serializeItem(item)));
                stmt.setInt(5, item.getAmount());
                stmt.setDouble(6, startingBid);
                stmt.setDouble(7, buyoutPrice != null ? buyoutPrice : 0);
                stmt.setString(8, category != null ? category : "All");
                stmt.setTimestamp(9, Timestamp.from(Instant.now()));
                stmt.setTimestamp(10, Timestamp.from(expires));
                
                stmt.executeUpdate();
                
                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        long listingId = rs.getLong(1);
                        
                        Listing listing = new Listing(
                                listingId, seller.getUniqueId(), seller.getName(),
                                "AUCTION", item.getType().name(), item.getAmount(),
                                startingBid, category, expires, "active"
                        );
                        activeListingsCache.put(listingId, listing);
                        
                        broadcastListingUpdate("created", listing);
                        
                        return new CreateListingResult(true, listingId, "Auction created!");
                    }
                }
            }
        } catch (SQLException e) {
            seller.getInventory().addItem(item);
            JsonLogger.error("auction_create_failed", Map.of(
                    "seller", seller.getName()
            ), e);
        }
        
        return new CreateListingResult(false, null, "Failed to create auction");
    }

    /**
     * Buy a listing directly
     */
    public BuyResult buyListing(Player buyer, long listingId) {
        if (!listingsConfig.itemSale().enabled()) {
            return new BuyResult(false, "Item sales are disabled");
        }
        
        Listing listing = getListing(listingId);
        if (listing == null) {
            return new BuyResult(false, "Listing not found");
        }
        
        if (!listing.status().equals("active")) {
            return new BuyResult(false, "Listing is no longer active");
        }
        
        if (listing.expiresAt().isBefore(Instant.now())) {
            return new BuyResult(false, "Listing has expired");
        }
        
        if (listing.sellerUuid().equals(buyer.getUniqueId())) {
            return new BuyResult(false, "You cannot buy your own listing");
        }
        
        // Check balance
        CurrencyService currencyService = plugin.getCurrencyService();
        if (currencyService == null) {
            return new BuyResult(false, "Currency system not available");
        }
        
        double price = listing.price();
        if (!currencyService.hasBalance(buyer.getUniqueId(), price)) {
            return new BuyResult(false, "Insufficient funds");
        }
        
        // Calculate tax and seller payout
        double tax = price * (listingsConfig.itemSale().taxPercent() / 100.0);
        double sellerPayout = price - tax;
        
        // Process payment
        CurrencyService.TransferResult transferResult = 
                currencyService.transfer(buyer.getUniqueId(), listing.sellerUuid(), price, "Purchase: " + listing.itemType());
        
        if (!transferResult.success()) {
            return new BuyResult(false, transferResult.message());
        }
        
        // Mark as sold
        try (Connection conn = db.getConnection()) {
            String updateSql = "UPDATE marketplace_listings SET status = 'sold', completed_at = ? WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                stmt.setLong(2, listingId);
                stmt.executeUpdate();
            }
            
            // Create item from stored data
            ItemStack item = deserializeItem(listing.itemData());
            
            // Give item to buyer
            HashMap<Integer, ItemStack> overflow = buyer.getInventory().addItem(item);
            
            // Return overflow to seller if inventory full
            if (!overflow.isEmpty()) {
                Player seller = Bukkit.getPlayer(listing.sellerUuid());
                if (seller != null) {
                    overflow.values().forEach(i -> seller.getInventory().addItem(i));
                }
            }
            
            // Update cache
            activeListingsCache.remove(listingId);
            
            // Broadcast update
            listing = new Listing(listing.id(), listing.sellerUuid(), listing.sellerName(),
                    listing.type(), listing.itemType(), listing.amount(), listing.price(),
                    listing.category(), listing.expiresAt(), "sold");
            broadcastListingUpdate("sold", listing);
            
            JsonLogger.info("listing_purchased", Map.of(
                    "listing_id", listingId,
                    "buyer", buyer.getName(),
                    "seller", listing.sellerName(),
                    "price", price
            ));
            
            return new BuyResult(true, "Purchase successful! Item given to your inventory.");
            
        } catch (SQLException e) {
            JsonLogger.error("listing_purchase_failed", Map.of(
                    "listing_id", listingId,
                    "buyer", buyer.getName()
            ), e);
            return new BuyResult(false, "Database error");
        }
    }

    /**
     * Place a bid on auction
     */
    public BidResult bidOnAuction(Player bidder, long listingId, double bidAmount) {
        if (!listingsConfig.auction().enabled()) {
            return new BidResult(false, "Auctions are disabled");
        }
        
        Listing listing = getListing(listingId);
        if (listing == null) {
            return new BidResult(false, "Listing not found");
        }
        
        if (!listing.type().equals("AUCTION")) {
            return new BidResult(false, "This is not an auction");
        }
        
        if (!listing.status().equals("active")) {
            return new BidResult(false, "Auction is no longer active");
        }
        
        if (listing.expiresAt().isBefore(Instant.now())) {
            return new BidResult(false, "Auction has ended");
        }
        
        if (listing.sellerUuid().equals(bidder.getUniqueId())) {
            return new BidResult(false, "You cannot bid on your own auction");
        }
        
        // Check bid amount
        double minBid = listing.currentBid() > 0 ? listing.currentBid() + 1 : listing.price();
        if (bidAmount < minBid) {
            return new BidResult(false, "Bid must be at least " + minBid);
        }
        
        // Check balance
        CurrencyService currencyService = plugin.getCurrencyService();
        if (currencyService == null) {
            return new BidResult(false, "Currency system not available");
        }
        
        if (!currencyService.hasBalance(bidder.getUniqueId(), bidAmount)) {
            return new BidResult(false, "Insufficient funds");
        }
        
        // Refund previous high bidder
        if (listing.currentBidder() != null) {
            currencyService.addBalance(listing.currentBidder(), listing.currentBid());
        }
        
        // Reserve bid amount from new bidder
        currencyService.removeBalance(bidder.getUniqueId(), bidAmount);
        
        try (Connection conn = db.getConnection()) {
            // Update listing
            String updateSql = """
                UPDATE marketplace_listings 
                SET current_bid = ?, current_bidder = ?, bid_count = bid_count + 1
                WHERE id = ?
                """;
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setDouble(1, bidAmount);
                stmt.setString(2, bidder.getUniqueId().toString());
                stmt.setLong(3, listingId);
                stmt.executeUpdate();
            }
            
            // Record bid
            String bidSql = """
                INSERT INTO marketplace_bids (listing_id, bidder_uuid, bidder_name, bid_amount, timestamp)
                VALUES (?, ?, ?, ?, ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(bidSql)) {
                stmt.setLong(1, listingId);
                stmt.setString(2, bidder.getUniqueId().toString());
                stmt.setString(3, bidder.getName());
                stmt.setDouble(4, bidAmount);
                stmt.setTimestamp(5, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
            
            // Check for extension
            long timeRemaining = listing.expiresAt().getEpochSecond() - Instant.now().getEpochSecond();
            if (timeRemaining < listingsConfig.auction().extensionThresholdSeconds()) {
                // Extend auction
                long extensionMs = listingsConfig.auction().extensionOnBidMinutes() * 60 * 1000L;
                Instant newExpiry = Instant.now().plusMillis(extensionMs);
                
                String extendSql = "UPDATE marketplace_listings SET expires_at = ? WHERE id = ?";
                try (PreparedStatement stmt = conn.prepareStatement(extendSql)) {
                    stmt.setTimestamp(1, Timestamp.from(newExpiry));
                    stmt.setLong(2, listingId);
                    stmt.executeUpdate();
                }
                
                listing = new Listing(listing.id(), listing.sellerUuid(), listing.sellerName(),
                        listing.type(), listing.itemType(), listing.amount(), listing.price(),
                        listing.category(), newExpiry, listing.status(), bidAmount, bidder.getUniqueId(),
                        listing.bidCount() + 1, listing.buyoutPrice());
            }
            
            // Update cache
            activeListingsCache.put(listingId, listing);
            
            // Broadcast update
            broadcastListingUpdate("bid", listing);
            
            JsonLogger.info("auction_bid", Map.of(
                    "listing_id", listingId,
                    "bidder", bidder.getName(),
                    "bid_amount", bidAmount
            ));
            
            return new BidResult(true, "Bid placed successfully!");
            
        } catch (SQLException e) {
            JsonLogger.error("auction_bid_failed", Map.of(
                    "listing_id", listingId,
                    "bidder", bidder.getName()
            ), e);
            return new BidResult(false, "Database error");
        }
    }

    /**
     * Process expired listings
     */
    public void processExpiredListings() {
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT * FROM marketplace_listings 
                WHERE status = 'active' AND expires_at < ?
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        long listingId = rs.getLong("id");
                        String type = rs.getString("listing_type");
                        String sellerUuid = rs.getString("seller_uuid");
                        double currentBid = rs.getDouble("current_bid");
                        String currentBidder = rs.getString("current_bidder");
                        
                        if (type.equals("AUCTION") && currentBidder != null) {
                            // Auction ended with bids - transfer item to winner
                            processAuctionEnd(conn, listingId, sellerUuid, currentBidder, currentBid);
                        } else if (type.equals("AUCTION") && currentBidder == null) {
                            // Auction ended without bids - return item to seller
                            processAuctionEndNoBids(conn, listingId, sellerUuid);
                        } else {
                            // Sale expired - return item to seller
                            processSaleExpired(conn, listingId, sellerUuid);
                        }
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("process_expired_listings_failed", Map.of(), e);
        }
    }

    private void processAuctionEnd(Connection conn, String sellerUuid, String winnerUuid, 
            double winningBid) throws SQLException {
        // Transfer money to seller
        CurrencyService currencyService = plugin.getCurrencyService();
        if (currencyService != null) {
            currencyService.addBalance(UUID.fromString(sellerUuid), winningBid);
        }
        
        // Mark as completed
        String updateSql = "UPDATE marketplace_listings SET status = 'completed', completed_at = ? WHERE id = ?";
        try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
            stmt.setTimestamp(1, Timestamp.from(Instant.now()));
            // Use the listing ID from the caller
            stmt.executeUpdate();
        }
    }

    private void processAuctionEndNoBids(Connection conn, long listingId, String sellerUuid) {
        // Return item to seller
        Listing listing = activeListingsCache.get(listingId);
        if (listing != null) {
            ItemStack item = deserializeItem(listing.itemData());
            Player seller = Bukkit.getPlayer(UUID.fromString(sellerUuid));
            if (seller != null) {
                seller.getInventory().addItem(item);
                seller.sendMessage("§e[NCDEv] §fYour auction for " + listing.itemType() + 
                        " ended with no bids. Item returned to your inventory.");
            }
        }
        
        // Mark as cancelled
        try (Connection conn2 = db.getConnection()) {
            String updateSql = "UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ?";
            try (PreparedStatement stmt = conn2.prepareStatement(updateSql)) {
                stmt.setLong(1, listingId);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            JsonLogger.error("process_auction_no_bids_failed", Map.of("listing_id", listingId), e);
        }
        
        activeListingsCache.remove(listingId);
    }

    private void processSaleExpired(Connection conn, long listingId, String sellerUuid) {
        Listing listing = activeListingsCache.get(listingId);
        if (listing != null) {
            ItemStack item = deserializeItem(listing.itemData());
            Player seller = Bukkit.getPlayer(UUID.fromString(sellerUuid));
            if (seller != null) {
                seller.getInventory().addItem(item);
                seller.sendMessage("§e[NCDEv] §fYour listing for " + listing.itemType() + 
                        " has expired. Item returned to your inventory.");
            }
        }
        
        try {
            String updateSql = "UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setLong(1, listingId);
                stmt.executeUpdate();
            }
        } catch (SQLException e) {
            // Already in transaction, ignore
        }
        
        activeListingsCache.remove(listingId);
    }

    /**
     * Get listing by ID
     */
    public Listing getListing(long listingId) {
        Listing cached = activeListingsCache.get(listingId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached;
        }
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM marketplace_listings WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setLong(1, listingId);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        Listing listing = parseListing(rs);
                        if (listing.status().equals("active")) {
                            activeListingsCache.put(listingId, listing);
                        }
                        return listing;
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_listing_failed", Map.of("listing_id", listingId), e);
        }
        
        return null;
    }

    /**
     * Get listings by category
     */
    public List<Listing> getListingsByCategory(String category, int limit, int offset) {
        List<Listing> listings = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT * FROM marketplace_listings 
                WHERE status = 'active' AND expires_at > ? 
                AND (category = ? OR ? = 'All')
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """;
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                stmt.setString(2, category);
                stmt.setString(3, category);
                stmt.setInt(4, limit);
                stmt.setInt(5, offset);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        listings.add(parseListing(rs));
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_listings_failed", Map.of("category", category), e);
        }
        
        return listings;
    }

    /**
     * Get player's active listings
     */
    public List<Listing> getPlayerListings(UUID playerUuid) {
        List<Listing> listings = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT * FROM marketplace_listings WHERE seller_uuid = ? AND status = 'active'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        listings.add(parseListing(rs));
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_player_listings_failed", Map.of(
                    "player_uuid", playerUuid.toString()
            ), e);
        }
        
        return listings;
    }

    /**
     * Get player's listing count
     */
    private int getPlayerListingCount(UUID playerUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT COUNT(*) FROM marketplace_listings WHERE seller_uuid = ? AND status = 'active'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        } catch (SQLException e) {
            // Ignore
        }
        return 0;
    }

    /**
     * Search listings
     */
    public List<Listing> searchListings(String query, String sortBy, int limit, int offset) {
        List<Listing> listings = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String orderBy = switch (sortBy) {
                case "price_asc" -> "price ASC";
                case "price_desc" -> "price DESC";
                case "ending_soon" -> "expires_at ASC";
                default -> "created_at DESC";
            };
            
            String sql = String.format("""
                SELECT * FROM marketplace_listings 
                WHERE status = 'active' AND expires_at > ? 
                AND (item_type LIKE ? OR category LIKE ?)
                ORDER BY %s
                LIMIT ? OFFSET ?
                """, orderBy);
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                stmt.setString(2, "%" + query + "%");
                stmt.setString(3, "%" + query + "%");
                stmt.setInt(4, limit);
                stmt.setInt(5, offset);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        listings.add(parseListing(rs));
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("search_listings_failed", Map.of("query", query), e);
        }
        
        return listings;
    }

    /**
     * Broadcast listing update
     */
    private void broadcastListingUpdate(String event, Listing listing) {
        SocketIOManager socketIO = plugin.getSocketIOManager();
        if (socketIO != null) {
            socketIO.broadcastMarketplaceUpdate(Map.of(
                    "event", event,
                    "listing", listing.toMap()
            ));
        }
    }

    /**
     * Parse listing from result set
     */
    private Listing parseListing(ResultSet rs) throws SQLException {
        return new Listing(
                rs.getLong("id"),
                UUID.fromString(rs.getString("seller_uuid")),
                rs.getString("seller_name"),
                rs.getString("listing_type"),
                rs.getString("item_type"),
                rs.getInt("amount"),
                rs.getDouble("price"),
                rs.getString("category"),
                rs.getTimestamp("expires_at").toInstant(),
                rs.getString("status"),
                rs.getDouble("current_bid"),
                rs.getString("current_bidder") != null ? 
                        UUID.fromString(rs.getString("current_bidder")) : null,
                rs.getInt("bid_count"),
                rs.getDouble("buyout_price")
        );
    }

    /**
     * Serialize item to JSON
     */
    private Map<String, Object> serializeItem(ItemStack item) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", item.getType().name());
        data.put("amount", item.getAmount());
        data.put("durability", item.getDurability());
        data.put("meta", item.getItemMeta() != null ? item.getItemMeta().toString() : null);
        return data;
    }

    /**
     * Deserialize item from JSON
     */
    private ItemStack deserializeItem(Map<String, Object> data) {
        if (data == null) {
            return new ItemStack(Material.STONE);
        }
        
        String type = (String) data.getOrDefault("type", "STONE");
        int amount = (Integer) data.getOrDefault("amount", 1);
        
        Material material = Material.getMaterial(type);
        if (material == null) {
            material = Material.STONE;
        }
        
        return new ItemStack(material, amount);
    }

    private ItemStack deserializeItem(String json) {
        if (json == null || json.isEmpty()) {
            return new ItemStack(Material.STONE);
        }
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = plugin.GSON.fromJson(json, Map.class);
            return deserializeItem(data);
        } catch (Exception e) {
            return new ItemStack(Material.STONE);
        }
    }

    // ==================== DATA CLASSES ====================

    public record Listing(
            long id,
            UUID sellerUuid,
            String sellerName,
            String type, // SALE, AUCTION, EXCHANGE
            String itemType,
            int amount,
            double price,
            String category,
            Instant expiresAt,
            String status,
            double currentBid,
            UUID currentBidder,
            int bidCount,
            double buyoutPrice
    ) {
        public Listing(long id, UUID sellerUuid, String sellerName, String type, 
                String itemType, int amount, double price, String category, 
                Instant expiresAt, String status) {
            this(id, sellerUuid, sellerName, type, itemType, amount, price, 
                    category, expiresAt, status, 0, null, 0, 0);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("id", id);
            map.put("seller_uuid", sellerUuid.toString());
            map.put("seller_name", sellerName);
            map.put("type", type);
            map.put("item_type", itemType);
            map.put("amount", amount);
            map.put("price", price);
            map.put("category", category);
            map.put("expires_at", expiresAt.toString());
            map.put("status", status);
            map.put("current_bid", currentBid);
            map.put("current_bidder", currentBidder != null ? currentBidder.toString() : null);
            map.put("bid_count", bidCount);
            map.put("buyout_price", buyoutPrice);
            return map;
        }
    }

    public record CreateListingResult(boolean success, Long listingId, String message) {}
    public record BuyResult(boolean success, String message) {}
    public record BidResult(boolean success, String message) {}
}
