/**
 * Python Bridge - Execute Python pathfinding scripts from Node.js
 */
const { spawn } = require('child_process');
const path = require('path');

class PythonBridge {
  constructor(pythonPath = 'python3', scriptDir = path.join(__dirname, '../python')) {
    this.pythonPath = pythonPath;
    this.scriptDir = scriptDir;
  }

  /**
   * Execute a Python script with JSON input
   * @param {string} scriptName - Name of Python script (e.g., 'pathfinding.py')
   * @param {object} data - Data to pass as JSON argument
   * @returns {Promise<object>} - Parsed JSON response from Python
   */
  async execute(scriptName, data) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.scriptDir, scriptName);

      // Add absolute path to graph file in the data
      const graphPath = path.join(this.scriptDir, 'combined_graph.gpickle');
      const dataWithPath = {
        ...data,
        graph_path: graphPath
      };
      
      const jsonInput = JSON.stringify(data);

      // Spawn Python process
      const pythonProcess = spawn(this.pythonPath, [scriptPath, jsonInput]);

      let stdout = '';
      let stderr = '';

      // Collect stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          return reject({
            error: 'Python process failed',
            code,
            stderr,
            stdout
          });
        }

        try {
          // Parse JSON response
          const result = JSON.parse(stdout);
          
          if (result.status === 'error') {
            return reject(result);
          }

          resolve(result);
        } catch (parseError) {
          reject({
            error: 'Failed to parse Python response',
            parseError: parseError.message,
            stdout,
            stderr
          });
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        reject({
          error: 'Failed to start Python process',
          message: error.message,
          pythonPath: this.pythonPath
        });
      });
    });
  }

  /**
   * Calculate routes using pathfinding.py
   */
  async calculateRoutes(startLat, startLon, destLat, destLon, enabledModes, maxTimeVariance = 20) {
    try {
      const result = await this.execute('pathfinding.py', {
        start_lat: startLat,
        start_lon: startLon,
        dest_lat: destLat,
        dest_lon: destLon,
        enabled_modes: enabledModes,
        max_time_variance_percent: maxTimeVariance
      });

      return result;
    } catch (error) {
      console.error('Python bridge error:', error);
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStats() {
    try {
      const result = await this.execute('pathfinding.py', {
        action: 'stats'
      });

      return result;
    } catch (error) {
      console.error('Python bridge error:', error);
      throw error;
    }
  }

  /**
   * Test Python bridge connection
   */
  async test() {
    try {
      const stats = await this.getGraphStats();
      return {
        success: true,
        message: 'Python bridge connected successfully',
        stats
      };
    } catch (error) {
      return {
        success: false,
        message: 'Python bridge connection failed',
        error
      };
    }
  }
}

// Singleton instance
let bridgeInstance = null;

/**
 * Get or create Python bridge singleton
 */
function getPythonBridge() {
  if (!bridgeInstance) {
    bridgeInstance = new PythonBridge();
  }
  return bridgeInstance;
}

module.exports = {
  PythonBridge,
  getPythonBridge
};