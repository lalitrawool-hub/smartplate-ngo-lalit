import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { requestApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MapPin, Package, Heart, Leaf, Drumstick } from 'lucide-react';

export const PublicFoodRequestPage = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    requestApi.getPublicById(requestId)
      .then((response) => {
        if (active) setRequest(response.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'This request could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [requestId]);

  const canDonate = request && ['approved', 'active'].includes(request.status)
    && request.quantity > (request.fulfilled_quantity || 0);

  const handleDonate = () => {
    if (isAuthenticated && user?.role === 'donor') {
      navigate(`/donor?request_id=${encodeURIComponent(request.id)}`);
    } else {
      navigate('/auth', { state: { returnTo: `/donor?request_id=${encodeURIComponent(request.id)}` } });
    }
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="animate-pulse text-muted-foreground">Loading food request...</p></main>;
  }

  if (!request) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-stone-200">
          <CardHeader><CardTitle>Request unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader>
          <CardContent><Button onClick={() => navigate('/')}>Go to SmartPlate</Button></CardContent>
        </Card>
      </main>
    );
  }

  const statusText = {
    pending: 'This request is waiting for admin approval. Donations will open once it is approved.',
    awaiting_delivery: 'The requested amount has been pledged. Delivery and NGO receipt confirmation are in progress.',
    fulfilled: 'The NGO confirmed receipt. This request is complete.',
  }[request.status];

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-stone-200">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{request.urgency_level || 'medium'} urgency</Badge>
            <Badge variant="outline">{request.status.replaceAll('_', ' ')}</Badge>
          </div>
          <CardTitle className="font-heading text-2xl">Food request from {request.ngo_name}</CardTitle>
          <CardDescription>Shared through SmartPlate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="flex items-center gap-2"><Package className="h-4 w-4" />{request.food_type} · {request.quantity} servings</span>
            {request.food_category && (
              <span className="flex items-center gap-2">
                {request.food_category === 'non-veg' ? <Drumstick className="h-4 w-4" /> : <Leaf className="h-4 w-4" />}
                {request.food_category}
              </span>
            )}
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{request.address}</span>
          </div>
          {request.description && <p className="text-muted-foreground">{request.description}</p>}
          <p className="text-sm text-muted-foreground">
            {request.confirmed_quantity || 0} servings received · {request.fulfilled_quantity || 0} pledged
          </p>
          {statusText && <p className="rounded-lg bg-secondary/60 p-3 text-sm">{statusText}</p>}
          {canDonate ? (
            <Button className="rounded-full" onClick={handleDonate}>
              <Heart className="h-4 w-4 mr-2" />Donate Food
            </Button>
          ) : request.status === 'fulfilled' ? (
            <Badge className="bg-success text-success-foreground">Order Completed</Badge>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};
