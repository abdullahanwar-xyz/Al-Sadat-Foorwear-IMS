import React from 'react';
import LogViewer from '../components/logs/log-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, AlertTriangle, Info, Bug, AlertCircle } from 'lucide-react';

const LogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-gray-500">
            Monitor application logs and troubleshoot issues
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Logs</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">Errors</div>
            <p className="text-xs text-gray-500">Critical issues requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning Logs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">Warnings</div>
            <p className="text-xs text-gray-500">Potential issues to monitor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info Logs</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Information</div>
            <p className="text-xs text-gray-500">General application events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debug Logs</CardTitle>
            <Bug className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">Debug</div>
            <p className="text-xs text-gray-500">Detailed diagnostic information</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Log Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">Log File Locations</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li><strong>Production:</strong> Stored in application data folder (Windows: %APPDATA%/IMS Desktop/logs/)</li>
              <li><strong>Development:</strong> Stored in project logs folder</li>
              <li><strong>Log Types:</strong> Combined logs, error logs, backend logs, and Electron main process logs</li>
            </ul>
          </div>
          
          <LogViewer />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Management Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Understanding Log Levels:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• <strong>ERROR:</strong> Critical issues that need immediate attention</li>
                <li>• <strong>WARN:</strong> Potential problems that should be monitored</li>
                <li>• <strong>INFO:</strong> General application events and status messages</li>
                <li>• <strong>DEBUG:</strong> Detailed information for troubleshooting</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Log Rotation:</h4>
              <p className="text-gray-600">
                Logs are automatically rotated daily with a maximum of 30 days retention. 
                Files are compressed to save disk space.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Troubleshooting:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Check error logs first for critical issues</li>
                <li>• Use the timestamp to correlate events</li>
                <li>• Look for stack traces in error messages</li>
                <li>• Monitor backend and frontend logs separately</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;