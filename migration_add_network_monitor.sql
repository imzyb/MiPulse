-- Database Migration: Add network_monitor_enabled column to vps_nodes table
-- This migration adds the network_monitor_enabled column that was added to the schema
-- but may be missing from existing databases

-- Add network_monitor_enabled column to vps_nodes table if it doesn't exist
ALTER TABLE vps_nodes ADD COLUMN network_monitor_enabled INTEGER DEFAULT 1;

-- Update existing records to have network_monitor_enabled = 1 (enabled by default)
UPDATE vps_nodes SET network_monitor_enabled = 1 WHERE network_monitor_enabled IS NULL;