package com.ncdev.social;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Social service for friends, follows, and reports.
 */
public class SocialService {

    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    private final NcDevConfig.Social config;

    public SocialService(DatabaseManager db, NcDevPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
        this.config = plugin.getNcDevConfig().social();
    }

    // ==================== FRIENDS ====================

    /**
     * Send friend request
     */
    public boolean sendFriendRequest(UUID senderUuid, UUID receiverUuid) {
        if (!config.enabled() || !config.friends().enabled()) return false;
        if (senderUuid.equals(receiverUuid)) return false;

        try (Connection conn = db.getConnection()) {
            // Check if request already exists
            String checkSql = """
                SELECT COUNT(*) FROM friendships 
                WHERE ((player_uuid = ? AND friend_uuid = ?) OR (player_uuid = ? AND friend_uuid = ?))
                """;
            try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                stmt.setString(1, senderUuid.toString());
                stmt.setString(2, receiverUuid.toString());
                stmt.setString(3, receiverUuid.toString());
                stmt.setString(4, senderUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        return false;
                    }
                }
            }

            // Create friend request
            String sql = "INSERT INTO friendships (player_uuid, friend_uuid, status, created_at) VALUES (?, ?, 'pending', ?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, senderUuid.toString());
                stmt.setString(2, receiverUuid.toString());
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }

            // Notify receiver
            Player receiver = Bukkit.getPlayer(receiverUuid);
            if (receiver != null && config.friends().notifications().requestReceived()) {
                receiver.sendMessage("§b§l[NCDEv] §f" + getPlayerName(senderUuid) + " sent you a friend request!");
            }

            JsonLogger.info("friend_request_sent", Map.of(
                    "sender", senderUuid.toString(),
                    "receiver", receiverUuid.toString()
            ));
            return true;
        } catch (SQLException e) {
            JsonLogger.error("friend_request_failed", Map.of(), e);
            return false;
        }
    }

    /**
     * Accept friend request
     */
    public boolean acceptFriendRequest(UUID accepterUuid, UUID requesterUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = """
                UPDATE friendships SET status = 'accepted', updated_at = ?
                WHERE player_uuid = ? AND friend_uuid = ? AND status = 'pending'
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setTimestamp(1, Timestamp.from(Instant.now()));
                stmt.setString(2, requesterUuid.toString());
                stmt.setString(3, accepterUuid.toString());
                
                int updated = stmt.executeUpdate();
                if (updated > 0) {
                    // Add reverse friendship
                    String reverseSql = """
                        INSERT INTO friendships (player_uuid, friend_uuid, status, created_at)
                        VALUES (?, ?, 'accepted', ?)
                        ON DUPLICATE KEY UPDATE status = 'accepted'
                        """;
                    try (PreparedStatement rs = conn.prepareStatement(reverseSql)) {
                        rs.setString(1, accepterUuid.toString());
                        rs.setString(2, requesterUuid.toString());
                        rs.setTimestamp(3, Timestamp.from(Instant.now()));
                        rs.executeUpdate();
                    }

                    // Notify both parties
                    if (config.friends().notifications().requestAccepted()) {
                        Player accepter = Bukkit.getPlayer(accepterUuid);
                        if (accepter != null) {
                            accepter.sendMessage("§a§l[NCDEv] §fFriend request accepted!");
                        }
                        Player requester = Bukkit.getPlayer(requesterUuid);
                        if (requester != null) {
                            requester.sendMessage("§a§l[NCDEv] §f" + getPlayerName(accepterUuid) + " accepted your friend request!");
                        }
                    }
                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("accept_friend_failed", Map.of(), e);
        }
        return false;
    }

    /**
     * Remove friend
     */
    public boolean removeFriend(UUID playerUuid, UUID friendUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = """
                DELETE FROM friendships 
                WHERE (player_uuid = ? AND friend_uuid = ?) OR (player_uuid = ? AND friend_uuid = ?)
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, friendUuid.toString());
                stmt.setString(3, friendUuid.toString());
                stmt.setString(4, playerUuid.toString());
                stmt.executeUpdate();
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Get player's friends
     */
    public List<Map<String, Object>> getFriends(UUID playerUuid) {
        List<Map<String, Object>> friends = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT p.uuid, p.name, p.status, f.created_at FROM friendships f
                JOIN players p ON (
                    (f.player_uuid = ? AND f.friend_uuid = p.uuid) OR
                    (f.friend_uuid = ? AND f.player_uuid = p.uuid)
                )
                WHERE f.status = 'accepted' AND f.player_uuid != ?
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, playerUuid.toString());
                stmt.setString(3, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> friend = new HashMap<>();
                        friend.put("uuid", rs.getString("uuid"));
                        friend.put("name", rs.getString("name"));
                        friend.put("status", rs.getString("status"));
                        friend.put("friend_since", rs.getTimestamp("created_at").toInstant().toString());
                        friends.add(friend);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_friends_failed", Map.of(), e);
        }
        return friends;
    }

    // ==================== FOLLOWS ====================

    /**
     * Follow a player
     */
    public boolean followPlayer(UUID followerUuid, UUID targetUuid) {
        if (!config.enabled() || !config.follow().enabled()) return false;

        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO follows (follower_uuid, following_uuid, created_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE created_at = ?
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, followerUuid.toString());
                stmt.setString(2, targetUuid.toString());
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
            
            Player target = Bukkit.getPlayer(targetUuid);
            if (target != null) {
                target.sendMessage("§b§l[NCDEv] §f" + getPlayerName(followerUuid) + " is now following you.");
            }
            
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Unfollow a player
     */
    public boolean unfollowPlayer(UUID followerUuid, UUID targetUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "DELETE FROM follows WHERE follower_uuid = ? AND following_uuid = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, followerUuid.toString());
                stmt.setString(2, targetUuid.toString());
                stmt.executeUpdate();
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    /**
     * Get followers
     */
    public List<Map<String, Object>> getFollowers(UUID playerUuid) {
        List<Map<String, Object>> followers = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = """
                SELECT p.uuid, p.name, f.created_at FROM follows f
                JOIN players p ON f.follower_uuid = p.uuid
                WHERE f.following_uuid = ?
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> follower = new HashMap<>();
                        follower.put("uuid", rs.getString("uuid"));
                        follower.put("name", rs.getString("name"));
                        followers.add(follower);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_followers_failed", Map.of(), e);
        }
        return followers;
    }

    // ==================== REPORTS ====================

    /**
     * Submit a report
     */
    public boolean submitReport(UUID reporterUuid, UUID targetUuid, String reason) {
        if (!config.enabled()) return false;

        try (Connection conn = db.getConnection()) {
            String sql = """
                INSERT INTO reports (reporter_uuid, reporter_name, target_uuid, target_name, reason, timestamp, status)
                VALUES (?, ?, ?, ?, ?, ?, 'open')
                """;
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, reporterUuid.toString());
                stmt.setString(2, getPlayerName(reporterUuid));
                stmt.setString(3, targetUuid.toString());
                stmt.setString(4, getPlayerName(targetUuid));
                stmt.setString(5, reason);
                stmt.setTimestamp(6, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }
            
            Player reporter = Bukkit.getPlayer(reporterUuid);
            if (reporter != null) {
                reporter.sendMessage("§a§l[NCDEv] §fReport submitted successfully!");
            }
            
            return true;
        } catch (SQLException e) {
            JsonLogger.error("submit_report_failed", Map.of(), e);
            return false;
        }
    }

    /**
     * Get reports
     */
    public List<Map<String, Object>> getReports(String status) {
        List<Map<String, Object>> reports = new ArrayList<>();
        
        try (Connection conn = db.getConnection()) {
            String sql = status != null ?
                    "SELECT * FROM reports WHERE status = ? ORDER BY timestamp DESC" :
                    "SELECT * FROM reports ORDER BY timestamp DESC";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                if (status != null) {
                    stmt.setString(1, status);
                }
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> report = new HashMap<>();
                        report.put("id", rs.getLong("id"));
                        report.put("reporter_uuid", rs.getString("reporter_uuid"));
                        report.put("reporter_name", rs.getString("reporter_name"));
                        report.put("target_uuid", rs.getString("target_uuid"));
                        report.put("target_name", rs.getString("target_name"));
                        report.put("reason", rs.getString("reason"));
                        report.put("timestamp", rs.getTimestamp("timestamp").toInstant().toString());
                        report.put("status", rs.getString("status"));
                        reports.add(report);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_reports_failed", Map.of(), e);
        }
        return reports;
    }

    // ==================== HELPERS ====================

    private String getPlayerName(UUID uuid) {
        Player player = Bukkit.getPlayer(uuid);
        return player != null ? player.getName() : uuid.toString();
    }
}
