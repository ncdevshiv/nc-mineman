package com.serverstats.service;

import com.serverstats.ServerStarPlugin;
import com.serverstats.database.DatabaseManager;
import com.serverstats.util.JsonLogger;

import java.sql.*;
import java.time.Instant;
import java.util.*;

public class SocialService {
    private final DatabaseManager db;
    private final ServerStarPlugin plugin;

    public SocialService(DatabaseManager db, ServerStarPlugin plugin) {
        this.db = db;
        this.plugin = plugin;
    }

    public boolean sendFriendRequest(UUID senderUuid, UUID receiverUuid) {
        if (senderUuid.equals(receiverUuid)) return false;

        try (Connection conn = db.getConnection()) {
            // Check if request already exists
            String checkSql = "SELECT COUNT(*) FROM friendships WHERE " +
                             "((player_uuid = ? AND friend_uuid = ?) OR (player_uuid = ? AND friend_uuid = ?))";
            try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                checkStmt.setString(1, senderUuid.toString());
                checkStmt.setString(2, receiverUuid.toString());
                checkStmt.setString(3, receiverUuid.toString());
                checkStmt.setString(4, senderUuid.toString());
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        return false; // Already exists
                    }
                }
            }

            // Insert friend request
            String sql = "INSERT INTO friendships (player_uuid, friend_uuid, status, created_at) VALUES (?, ?, 'pending', ?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, senderUuid.toString());
                stmt.setString(2, receiverUuid.toString());
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }

            JsonLogger.info("friend_request_sent", Map.of(
                "sender_uuid", senderUuid.toString(),
                "receiver_uuid", receiverUuid.toString()
            ));

            return true;
        } catch (SQLException e) {
            JsonLogger.error("friend_request_error", Map.of(
                "sender_uuid", senderUuid.toString(),
                "receiver_uuid", receiverUuid.toString()
            ), e);
            return false;
        }
    }

    public boolean acceptFriendRequest(UUID accepterUuid, UUID requesterUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE friendships SET status = 'accepted' WHERE " +
                        "player_uuid = ? AND friend_uuid = ? AND status = 'pending'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, requesterUuid.toString());
                stmt.setString(2, accepterUuid.toString());
                int updated = stmt.executeUpdate();

                if (updated > 0) {
                    JsonLogger.info("friend_request_accepted", Map.of(
                        "accepter_uuid", accepterUuid.toString(),
                        "requester_uuid", requesterUuid.toString()
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("accept_friend_request_error", Map.of(
                "accepter_uuid", accepterUuid.toString(),
                "requester_uuid", requesterUuid.toString()
            ), e);
        }
        return false;
    }

    public boolean removeFriend(UUID removerUuid, UUID friendUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "DELETE FROM friendships WHERE " +
                        "((player_uuid = ? AND friend_uuid = ?) OR (player_uuid = ? AND friend_uuid = ?)) " +
                        "AND status = 'accepted'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, removerUuid.toString());
                stmt.setString(2, friendUuid.toString());
                stmt.setString(3, friendUuid.toString());
                stmt.setString(4, removerUuid.toString());
                int deleted = stmt.executeUpdate();

                if (deleted > 0) {
                    JsonLogger.info("friend_removed", Map.of(
                        "remover_uuid", removerUuid.toString(),
                        "friend_uuid", friendUuid.toString()
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("remove_friend_error", Map.of(
                "remover_uuid", removerUuid.toString(),
                "friend_uuid", friendUuid.toString()
            ), e);
        }
        return false;
    }

    public List<Map<String, Object>> getFriends(UUID playerUuid) {
        List<Map<String, Object>> friends = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT p.uuid, p.name, f.created_at FROM friendships f " +
                        "JOIN players p ON ((f.player_uuid = p.uuid AND f.friend_uuid = ?) OR " +
                        "(f.friend_uuid = p.uuid AND f.player_uuid = ?)) " +
                        "WHERE f.status = 'accepted' AND p.uuid != ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                stmt.setString(2, playerUuid.toString());
                stmt.setString(3, playerUuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> friend = new HashMap<>();
                        friend.put("uuid", rs.getString("uuid"));
                        friend.put("name", rs.getString("name"));
                        friend.put("since", rs.getTimestamp("created_at"));
                        friends.add(friend);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_friends_error", Map.of("uuid", playerUuid.toString()), e);
        }
        return friends;
    }

    public List<Map<String, Object>> getFriendRequests(UUID playerUuid) {
        List<Map<String, Object>> requests = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT p.uuid, p.name, f.created_at FROM friendships f " +
                        "JOIN players p ON f.player_uuid = p.uuid " +
                        "WHERE f.friend_uuid = ? AND f.status = 'pending'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, playerUuid.toString());
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> request = new HashMap<>();
                        request.put("uuid", rs.getString("uuid"));
                        request.put("name", rs.getString("name"));
                        request.put("requested_at", rs.getTimestamp("created_at"));
                        requests.add(request);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_friend_requests_error", Map.of("uuid", playerUuid.toString()), e);
        }
        return requests;
    }

    public boolean followPlayer(UUID followerUuid, UUID targetUuid) {
        // For simplicity, following is just stored as a separate table or we can reuse friendships
        // Let's create a simple follow system
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO friendships (player_uuid, friend_uuid, status, created_at) " +
                        "VALUES (?, ?, 'following', ?) ON DUPLICATE KEY UPDATE status = 'following'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, followerUuid.toString());
                stmt.setString(2, targetUuid.toString());
                stmt.setTimestamp(3, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }

            JsonLogger.info("player_followed", Map.of(
                "follower_uuid", followerUuid.toString(),
                "target_uuid", targetUuid.toString()
            ));

            return true;
        } catch (SQLException e) {
            JsonLogger.error("follow_player_error", Map.of(
                "follower_uuid", followerUuid.toString(),
                "target_uuid", targetUuid.toString()
            ), e);
            return false;
        }
    }

    public boolean unfollowPlayer(UUID followerUuid, UUID targetUuid) {
        try (Connection conn = db.getConnection()) {
            String sql = "DELETE FROM friendships WHERE player_uuid = ? AND friend_uuid = ? AND status = 'following'";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, followerUuid.toString());
                stmt.setString(2, targetUuid.toString());
                int deleted = stmt.executeUpdate();

                if (deleted > 0) {
                    JsonLogger.info("player_unfollowed", Map.of(
                        "follower_uuid", followerUuid.toString(),
                        "target_uuid", targetUuid.toString()
                    ));

                    return true;
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("unfollow_player_error", Map.of(
                "follower_uuid", followerUuid.toString(),
                "target_uuid", targetUuid.toString()
            ), e);
        }
        return false;
    }

    public List<Map<String, Object>> getFollowers(UUID playerUuid) {
        List<Map<String, Object>> followers = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT p.uuid, p.name FROM friendships f " +
                        "JOIN players p ON f.player_uuid = p.uuid " +
                        "WHERE f.friend_uuid = ? AND f.status = 'following'";
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
            JsonLogger.error("get_followers_error", Map.of("uuid", playerUuid.toString()), e);
        }
        return followers;
    }

    public boolean submitReport(UUID reporterUuid, UUID targetUuid, String reason) {
        try (Connection conn = db.getConnection()) {
            String sql = "INSERT INTO reports (reporter_uuid, target_uuid, reason, timestamp, status) " +
                        "VALUES (?, ?, ?, ?, 'open')";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, reporterUuid.toString());
                stmt.setString(2, targetUuid.toString());
                stmt.setString(3, reason);
                stmt.setTimestamp(4, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
            }

            JsonLogger.info("report_submitted", Map.of(
                "reporter_uuid", reporterUuid.toString(),
                "target_uuid", targetUuid.toString(),
                "reason", reason
            ));

            return true;
        } catch (SQLException e) {
            JsonLogger.error("submit_report_error", Map.of(
                "reporter_uuid", reporterUuid.toString(),
                "target_uuid", targetUuid.toString()
            ), e);
            return false;
        }
    }

    public List<Map<String, Object>> getReports(String status) {
        List<Map<String, Object>> reports = new ArrayList<>();
        try (Connection conn = db.getConnection()) {
            String sql = "SELECT r.*, rp.name as reporter_name, tp.name as target_name FROM reports r " +
                        "JOIN players rp ON r.reporter_uuid = rp.uuid " +
                        "JOIN players tp ON r.target_uuid = tp.uuid " +
                        "WHERE r.status = ? ORDER BY r.timestamp DESC";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, status != null ? status : "open");
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> report = new HashMap<>();
                        report.put("id", rs.getLong("id"));
                        report.put("reporter_uuid", rs.getString("reporter_uuid"));
                        report.put("reporter_name", rs.getString("reporter_name"));
                        report.put("target_uuid", rs.getString("target_uuid"));
                        report.put("target_name", rs.getString("target_name"));
                        report.put("reason", rs.getString("reason"));
                        report.put("timestamp", rs.getTimestamp("timestamp"));
                        report.put("status", rs.getString("status"));
                        reports.add(report);
                    }
                }
            }
        } catch (SQLException e) {
            JsonLogger.error("get_reports_error", Map.of("status", status), e);
        }
        return reports;
    }

    public boolean updateReportStatus(long reportId, String status) {
        try (Connection conn = db.getConnection()) {
            String sql = "UPDATE reports SET status = ? WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, status);
                stmt.setLong(2, reportId);
                return stmt.executeUpdate() > 0;
            }
        } catch (SQLException e) {
            JsonLogger.error("update_report_status_error", Map.of("report_id", reportId), e);
            return false;
        }
    }
}