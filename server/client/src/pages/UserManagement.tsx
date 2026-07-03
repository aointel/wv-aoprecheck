import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md';

export default function UserManagement() {
  const mockUsers = [
    { id: '1', name: 'Demo Agent', email: 'demo@connectnow.com', role: 'Agent', status: 'Active', lastLogin: '2 hours ago' },
    { id: '2', name: 'Agent Smith', email: 'smith@aoglobelife.com', role: 'Agent', status: 'Active', lastLogin: '1 day ago' },
    { id: '3', name: 'Admin User', email: 'admin@aoglobelife.com', role: 'Admin', status: 'Active', lastLogin: '30 minutes ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button>
          <MdAdd className="mr-2" />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-muted-foreground">Call agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-muted-foreground">Administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Online Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'Admin' ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Badge variant={user.status === 'Active' ? "default" : "destructive"}>
                    {user.status}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">Last: {user.lastLogin}</p>
                  <Button variant="outline" size="sm">
                    <MdEdit />
                  </Button>
                  <Button variant="outline" size="sm">
                    <MdDelete />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}