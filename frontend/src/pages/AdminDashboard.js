import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  Shield, 
  Users, 
  Building2, 
  Truck, 
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  TrendingUp,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState({ ngo_verifications: [], volunteer_verifications: [] });
  const [allRequests, setAllRequests] = useState([]);
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState({ open: false, type: '', id: '', action: '' });
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, pendingRes, reqRes, delRes, usersRes] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getPendingVerifications(),
        adminApi.getAllRequests(),
        adminApi.getAllDeliveries(),
        adminApi.getAllUsers(),
      ]);
      
      setDashboard(dashRes.data);
      setPendingVerifications(pendingRes.data);
      setAllRequests(reqRes.data || []);
      setAllDeliveries(delRes.data || []);
      setAllUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReview = async () => {
    try {
      if (reviewDialog.type === 'ngo') {
        await adminApi.reviewNGO(reviewDialog.id, reviewDialog.action, rejectionReason || null);
      } else if (reviewDialog.type === 'volunteer') {
        await adminApi.reviewVolunteer(reviewDialog.id, reviewDialog.action, rejectionReason || null);
      }
      
      toast.success(
        reviewDialog.action === 'approve' 
          ? 'Approval recorded! Waiting for second admin approval.' 
          : 'Verification rejected.'
      );
      setReviewDialog({ open: false, type: '', id: '', action: '' });
      setRejectionReason('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Review failed');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await adminApi.approveRequest(requestId);
      toast.success('Request approved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    }
  };

  const handleCalculateUrgency = async (requestId) => {
    try {
      const response = await adminApi.calculateUrgencyScore(requestId);
      toast.success(`AI Urgency Score: ${response.data.urgency_score.toFixed(1)}/10`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate urgency');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Dual-admin governance panel</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-stone-200" data-testid="stat-users">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard?.total_users || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-pending-ngo">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-xl">
                  <Building2 className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard?.pending_ngo_verifications || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending NGOs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-pending-volunteer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-xl">
                  <Truck className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard?.pending_volunteer_verifications || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending Volunteers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-active-requests">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-xl">
                  <Package className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard?.active_requests || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="verifications" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="verifications" data-testid="tab-verifications">
              <Clock className="h-4 w-4 mr-2" />
              Verifications
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              <FileText className="h-4 w-4 mr-2" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="deliveries" data-testid="tab-deliveries">
              <Truck className="h-4 w-4 mr-2" />
              Deliveries
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Verifications Tab */}
          <TabsContent value="verifications" className="space-y-6">
            {/* NGO Verifications */}
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Pending NGO Verifications
                </CardTitle>
                <CardDescription>Requires dual-admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingVerifications.ngo_verifications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending NGO verifications</p>
                ) : (
                  <div className="space-y-4">
                    {pendingVerifications.ngo_verifications.map((v) => (
                      <div 
                        key={v.id} 
                        className="p-4 rounded-xl border border-stone-200"
                        data-testid={`ngo-verification-${v.id}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold">{v.organization_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Reg. No: {v.registration_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {v.address}, {v.city}, {v.state} - {v.pincode}
                            </p>
                            {v.description && (
                              <p className="text-sm text-muted-foreground">{v.description}</p>
                            )}
                            {v.documents?.length > 0 && (
                              <p className="text-sm text-primary">
                                {v.documents.length} document(s) uploaded
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="rounded-full"
                              onClick={() => setReviewDialog({ 
                                open: true, 
                                type: 'ngo', 
                                id: v.id, 
                                action: 'reject' 
                              })}
                              data-testid={`reject-ngo-${v.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button 
                              className="rounded-full"
                              onClick={() => setReviewDialog({ 
                                open: true, 
                                type: 'ngo', 
                                id: v.id, 
                                action: 'approve' 
                              })}
                              data-testid={`approve-ngo-${v.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Volunteer Verifications */}
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Truck className="h-5 w-5 text-accent" />
                  Pending Volunteer Verifications
                </CardTitle>
                <CardDescription>Requires dual-admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingVerifications.volunteer_verifications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending volunteer verifications</p>
                ) : (
                  <div className="space-y-4">
                    {pendingVerifications.volunteer_verifications.map((v) => (
                      <div 
                        key={v.id} 
                        className="p-4 rounded-xl border border-stone-200"
                        data-testid={`volunteer-verification-${v.user_id}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{v.user_name || 'Unknown'}</h4>
                            <p className="text-sm text-muted-foreground">{v.user_email}</p>
                            <p className="text-sm text-muted-foreground">
                              Transport: {v.transport_mode || 'Not specified'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="rounded-full"
                              onClick={() => setReviewDialog({ 
                                open: true, 
                                type: 'volunteer', 
                                id: v.user_id, 
                                action: 'reject' 
                              })}
                              data-testid={`reject-volunteer-${v.user_id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button 
                              className="rounded-full"
                              onClick={() => setReviewDialog({ 
                                open: true, 
                                type: 'volunteer', 
                                id: v.user_id, 
                                action: 'approve' 
                              })}
                              data-testid={`approve-volunteer-${v.user_id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="font-heading">All Food Requests</CardTitle>
                <CardDescription>Manage and approve food requests</CardDescription>
              </CardHeader>
              <CardContent>
                {allRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No requests yet</p>
                ) : (
                  <div className="space-y-4">
                    {allRequests.map((request) => (
                      <div 
                        key={request.id} 
                        className="p-4 rounded-xl border border-stone-200"
                        data-testid={`request-${request.id}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{request.ngo_name}</h4>
                              <Badge className={
                                request.status === 'approved' || request.status === 'active' || request.status === 'fulfilled'
                                  ? 'bg-success text-success-foreground' 
                                  : request.status === 'pending' || request.status === 'awaiting_delivery'
                                    ? 'bg-warning text-warning-foreground'
                                    : 'bg-secondary text-secondary-foreground'
                              }>
                                {request.status.replace(/_/g, ' ')}
                              </Badge>
                              {request.ai_urgency_score && (
                                <Badge className="bg-primary/10 text-primary">
                                  AI Score: {request.ai_urgency_score.toFixed(1)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.food_type} • {request.quantity} servings • {request.urgency_level} urgency
                            </p>
                            <p className="text-sm text-muted-foreground">{request.address}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="rounded-full"
                              onClick={() => handleCalculateUrgency(request.id)}
                              data-testid={`ai-score-${request.id}`}
                            >
                              <Brain className="h-4 w-4 mr-2" />
                              AI Score
                            </Button>
                            {request.status === 'pending' && (
                              <Button 
                                size="sm"
                                className="rounded-full"
                                onClick={() => handleApproveRequest(request.id)}
                                data-testid={`approve-request-${request.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deliveries Tab */}
          <TabsContent value="deliveries">
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="font-heading">All Deliveries</CardTitle>
                <CardDescription>Monitor delivery progress</CardDescription>
              </CardHeader>
              <CardContent>
                {allDeliveries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No deliveries yet</p>
                ) : (
                  <div className="space-y-4">
                    {allDeliveries.map((delivery) => (
                      <div 
                        key={delivery.id} 
                        className="p-4 rounded-xl border border-stone-200"
                        data-testid={`delivery-${delivery.id}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className={
                                delivery.status === 'delivered' || delivery.status === 'confirmed'
                                  ? 'bg-success text-success-foreground'
                                  : delivery.status === 'pending'
                                    ? 'bg-warning text-warning-foreground'
                                    : 'bg-primary text-primary-foreground'
                              }>
                                {delivery.status}
                              </Badge>
                              {delivery.extra_volunteer_required && (
                                <Badge className="bg-accent text-accent-foreground">
                                  Extra Help Needed
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: {delivery.pickup_address}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              To: {delivery.dropoff_address}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Volunteer: {delivery.volunteer_id || 'Unassigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="font-heading">All Users</CardTitle>
                <CardDescription>Platform users overview</CardDescription>
              </CardHeader>
              <CardContent>
                {allUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No users yet</p>
                ) : (
                  <div className="space-y-4">
                    {allUsers.map((u) => (
                      <div 
                        key={u.id} 
                        className="p-4 rounded-xl border border-stone-200"
                        data-testid={`user-${u.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{u.name}</h4>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-secondary text-secondary-foreground">
                              {u.role || 'No role'}
                            </Badge>
                            {u.is_verified && (
                              <Badge className="bg-success text-success-foreground">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, type: '', id: '', action: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'} {reviewDialog.type === 'ngo' ? 'NGO' : 'Volunteer'} Verification
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === 'approve' 
                ? 'This action requires dual-admin approval. Your approval will be recorded.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          
          {reviewDialog.action === 'reject' && (
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              data-testid="rejection-reason"
            />
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReviewDialog({ open: false, type: '', id: '', action: '' })}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReview}
              className={reviewDialog.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
              data-testid="confirm-review"
            >
              {reviewDialog.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
