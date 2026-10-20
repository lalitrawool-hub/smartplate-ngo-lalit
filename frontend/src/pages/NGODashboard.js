import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ngoApi, requestApi, analyticsApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DashboardLayout } from '../components/DashboardLayout';
import { NGOVerificationForm } from '../components/NGOVerificationForm';
import { CreateRequestModal } from '../components/CreateRequestModal';
import { 
  Building2, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Package,
  TrendingUp,
  FileText,
  MapPin,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';

export const NGODashboard = () => {
  const { user } = useAuth();
  const [verification, setVerification] = useState(null);
  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [verRes, reqRes, anaRes] = await Promise.all([
        ngoApi.getVerification(),
        ngoApi.getRequests().catch(() => ({ data: [] })),
        analyticsApi.getUser(),
      ]);
      
      setVerification(verRes.data);
      setRequests(reqRes.data || []);
      setAnalytics(anaRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmReceipt = async (requestId) => {
    try {
      await ngoApi.confirmReceipt(requestId);
      toast.success('Receipt confirmed!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm receipt');
    }
  };

  const handleShareRequest = async (request) => {
    const url = `${window.location.origin}/requests/${request.id}`;
    const shareData = {
      title: `${request.food_type} food request from ${request.ngo_name || verification?.organization_name || 'SmartPlate NGO'}`,
      text: `Help fulfill this ${request.urgency_level || 'food'} food request on SmartPlate.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Public request link copied');
      } else {
        window.prompt('Copy this public request link:', url);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error('Could not share the request. Copy this link instead: ' + url);
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-warning text-warning-foreground', icon: Clock },
      approved: { color: 'bg-success text-success-foreground', icon: CheckCircle2 },
      rejected: { color: 'bg-destructive text-destructive-foreground', icon: AlertCircle },
      active: { color: 'bg-primary text-primary-foreground', icon: Package },
      awaiting_delivery: { color: 'bg-warning text-warning-foreground', icon: Clock },
      fulfilled: { color: 'bg-success text-success-foreground', icon: CheckCircle2 },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())}
      </Badge>
    );
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

  // Show verification form if not verified
  if (!verification || verification.status !== 'approved') {
    return (
      <DashboardLayout>
        <div data-testid="ngo-verification-section">
          <NGOVerificationForm 
            existingVerification={verification} 
            onSubmit={fetchData}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="ngo-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Welcome, {verification.organization_name}
            </h1>
            <p className="text-muted-foreground mt-1">Manage your food requests and track deliveries</p>
          </div>
          <Button 
            className="rounded-full" 
            onClick={() => setShowCreateModal(true)}
            data-testid="create-request-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-stone-200" data-testid="stat-requests">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.total_requests || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-requested">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-xl">
                  <Package className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.total_requested_meals || 0}</p>
                  <p className="text-sm text-muted-foreground">Meals Requested</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-received">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.total_received_meals || 0}</p>
                  <p className="text-sm text-muted-foreground">Meals Received</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-stone-200" data-testid="stat-rate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(analytics?.fulfillment_rate || 0).toFixed(0)}%</p>
                  <p className="text-sm text-muted-foreground">Fulfillment Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests */}
        <Card className="border-stone-200">
          <CardHeader>
            <CardTitle className="font-heading">Your Food Requests</CardTitle>
            <CardDescription>Track and manage all your food requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No requests yet. Create your first request!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div 
                    key={request.id} 
                    className="p-4 rounded-xl border border-stone-200 hover:bg-secondary/30 smooth-transition"
                    data-testid={`request-${request.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{request.food_type} Food</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.quantity} servings • {request.urgency_level} urgency
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {request.address}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {['pending', 'approved', 'active', 'awaiting_delivery', 'fulfilled'].includes(request.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handleShareRequest(request)}
                            data-testid={`share-request-${request.id}`}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </Button>
                        )}
                        {request.fulfilled_quantity > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {request.fulfilled_quantity}/{request.quantity} pledged · {request.confirmed_quantity || 0} received
                          </span>
                        )}
                        {request.status === 'fulfilled' && (
                          <Badge className="bg-success text-success-foreground">Order Completed</Badge>
                        )}
                        {request.ready_to_confirm && request.status !== 'fulfilled' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handleConfirmReceipt(request.id)}
                            data-testid={`confirm-receipt-${request.id}`}
                          >
                            Confirm Receipt
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
      </div>

      <CreateRequestModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onSuccess={fetchData}
        verification={verification}
      />
    </DashboardLayout>
  );
};
