// /api/schedules/execute.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Only allow POST requests for security, but also allow GET for Vercel Cron
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // API key based authentication - Skip if it's from Vercel Cron
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.SCHEDULE_EXECUTOR_API_KEY;
    const isVercelCron = req.headers['x-vercel-cron'] === 'true';
    
    // Validate API key if configured and not from Vercel Cron
    if (expectedApiKey && apiKey !== expectedApiKey && !isVercelCron) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Database configuration missing' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the SimpleMDM API key
    const simpleMdmApiKey = process.env.SIMPLEMDM_API_KEY || process.env.VITE_SIMPLEMDM_API_KEY;
    
    if (!simpleMdmApiKey) {
      console.error('SimpleMDM API key not configured');
      return res.status(500).json({ error: 'SimpleMDM API key not configured' });
    }

    // Find schedules due for execution
    const now = new Date();
    // Look for schedules that should have run in the last 15 minutes
    // This accommodates for cron jobs that might not run exactly on schedule
    const pastWindow = new Date(now.getTime() - 15 * 60 * 1000);
    
    const { data: schedulesToExecute, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('enabled', true)
      .lte('start_time', now.toISOString())
      .gt('start_time', pastWindow.toISOString())
      .is('last_executed_at', null)
      .order('start_time', { ascending: true });
    
    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return res.status(500).json({ error: 'Failed to fetch schedules', details: schedulesError.message });
    }
    
    // If no schedules to execute, return success
    if (!schedulesToExecute || schedulesToExecute.length === 0) {
      return res.status(200).json({ message: 'No schedules to execute' });
    }
    
    console.log(`Found ${schedulesToExecute.length} schedules to execute`);
    
    // Process each schedule
    const results = await Promise.all(schedulesToExecute.map(async (schedule) => {
      try {
        // For recurring schedules, calculate the next execution time
        let updateData = { last_executed_at: now.toISOString() };
        
        if (schedule.schedule_type === 'recurring' && schedule.recurrence_pattern) {
          // Calculate next execution time based on recurrence pattern
          // This is a simple implementation and might need to be more sophisticated
          const nextTime = calculateNextExecutionTime(
            new Date(schedule.start_time), 
            schedule.recurrence_pattern,
            schedule.recurrence_days
          );
          
          if (nextTime) {
            updateData.start_time = nextTime.toISOString();
            updateData.last_executed_at = null; // Reset so it can execute again
          }
        }
        
        // Get devices that match the filter
        let targetDevices = [];
        
        // If there's a device filter, apply it
        if (schedule.device_filter) {
          try {
            const filter = JSON.parse(schedule.device_filter);
            // Fetch devices based on the filter
            const { data: devices } = await fetchFilteredDevices(filter, simpleMdmApiKey);
            targetDevices = devices || [];
          } catch (filterError) {
            console.error(`Error processing device filter for schedule ${schedule.id}:`, filterError);
            // If filter fails, don't apply to any devices
            targetDevices = [];
          }
        } else {
          // If no filter, get all devices
          const { data: devices } = await fetchAllDevices(simpleMdmApiKey);
          targetDevices = devices || [];
        }
        
        // Apply the profile to each device
        const profileApplicationResults = await Promise.all(
          targetDevices.map(device => 
            pushProfileToDevice(schedule.profile_id, device.id, simpleMdmApiKey)
          )
        );
        
        // Update the schedule in the database
        const { error: updateError } = await supabase
          .from('schedules')
          .update(updateData)
          .eq('id', schedule.id);
        
        if (updateError) {
          throw new Error(`Failed to update schedule: ${updateError.message}`);
        }
        
        return {
          scheduleId: schedule.id,
          profileId: schedule.profile_id,
          devicesCount: targetDevices.length,
          success: true,
          message: `Profile ${schedule.profile_id} pushed to ${targetDevices.length} devices`,
          nextExecution: updateData.start_time || null
        };
      } catch (scheduleError) {
        console.error(`Error executing schedule ${schedule.id}:`, scheduleError);
        return {
          scheduleId: schedule.id,
          success: false,
          error: scheduleError.message
        };
      }
    }));
    
    return res.status(200).json({
      executed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    console.error('Schedule execution error:', error);
    return res.status(500).json({ error: 'Schedule execution failed', details: error.message });
  }
}

// Helper function to calculate next execution time based on recurrence pattern
function calculateNextExecutionTime(currentTime, pattern, recurrenceDays) {
  const nextTime = new Date(currentTime);
  
  switch (pattern) {
    case 'daily':
      nextTime.setDate(nextTime.getDate() + 1);
      break;
      
    case 'weekly':
      if (Array.isArray(recurrenceDays) && recurrenceDays.length > 0) {
        // Get current day of week (0 = Sunday, 6 = Saturday)
        const currentDay = nextTime.getDay();
        
        // Find the next day in the recurrence array
        const sortedDays = [...recurrenceDays].sort((a, b) => a - b);
        let nextDay = sortedDays.find(day => day > currentDay);
        
        if (nextDay === undefined) {
          // If no day is greater than current day, take the first day and add a week
          nextDay = sortedDays[0];
          nextTime.setDate(nextTime.getDate() + (7 - currentDay + nextDay));
        } else {
          // Set to the next day in the same week
          nextTime.setDate(nextTime.getDate() + (nextDay - currentDay));
        }
      } else {
        // Default: add 7 days
        nextTime.setDate(nextTime.getDate() + 7);
      }
      break;
      
    case 'monthly':
      // Move to the next month, same day
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
      
    default:
      return null; // Not a recurring schedule or unknown pattern
  }
  
  return nextTime;
}

// Helper function to fetch all devices from SimpleMDM
async function fetchAllDevices(apiKey) {
  try {
    const response = await fetch('https://a.simplemdm.com/api/v1/devices', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SimpleMDM API error: ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data };
  } catch (error) {
    console.error('Error fetching devices:', error);
    return { data: [], error };
  }
}

// Helper function to fetch filtered devices
async function fetchFilteredDevices(filter, apiKey) {
  // This is a simplified implementation
  // In a real-world scenario, you might need more complex filtering logic
  const devices = await fetchAllDevices(apiKey);
  
  if (!devices.data) return { data: [] };
  
  // Apply filter - this is very basic and should be enhanced based on your requirements
  let filteredDevices = devices.data;
  
  if (filter.groupIds && filter.groupIds.length > 0) {
    // If you have device group IDs to filter by, add logic here
    // This would require additional API calls to get group members
  }
  
  if (filter.nameContains) {
    filteredDevices = filteredDevices.filter(device => 
      device.attributes.name.toLowerCase().includes(filter.nameContains.toLowerCase())
    );
  }
  
  return { data: filteredDevices };
}

// Helper function to push a profile to a device
async function pushProfileToDevice(profileId, deviceId, apiKey) {
  try {
    const response = await fetch(`https://a.simplemdm.com/api/v1/profiles/${profileId}/devices/${deviceId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SimpleMDM API error (${response.status}): ${errorText}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error pushing profile ${profileId} to device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
}