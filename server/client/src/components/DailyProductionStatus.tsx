import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ConnectTypeModal } from "@/components/ConnectTypeModal";
import { 
  Calendar, 
  Phone, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Target,
  TrendingUp,
  DollarSign,
  Users
} from "lucide-react";

interface DailyProductionProps {
  agentEmail: string;
  date?: Date;
}

interface ProductionStatusData {
  aoiAppointments: any[];
  pressSales: any[];
  instantPresentations: any[];
  callbacks: any[];
  totalConnects: number;
  pendingFollowUps: number;
  confirmedAppointments: number;
  completedSales: number;
}

const connectTypeDisplayNames = {
  'aoi_appointment': 'AOI Appointments',
  'press_sale': 'Press Sales',
  'instant_presentation': 'Instant Presentations',
  'callback_scheduled': 'Scheduled Callbacks',
  'other': 'Other Connects'
};

const productionStatusColors = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'confirmed': 'bg-green-100 text-green-800',
  'cancelled': 'bg-red-100 text-red-800',
  'no_show': 'bg-gray-100 text-gray-800',
  'completed': 'bg-emerald-100 text-emerald-800'
};

export function DailyProductionStatus({ agentEmail, date }: DailyProductionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConnect, setSelectedConnect] = useState<any>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  
  const targetDate = date || new Date();
  const dateString = targetDate.toISOString().split('T')[0];

  // Fetch daily production status
  const { data: productionData, isLoading } = useQuery<ProductionStatusData>({
    queryKey: ['/api/war/daily-production', agentEmail, dateString],
    enabled: !!agentEmail,
  });

  // Mutation to update production status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ connectId, productionStatus, immediateOutcome, notes }: {
      connectId: string;
      productionStatus: string;
      immediateOutcome?: string;
      notes?: string;
    }) => {
      return await apiRequest('POST', '/api/war/production-status', {
        connectId,
        productionStatus,
        immediateOutcome,
        notes
      });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Production status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/war/daily-production'] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!productionData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-gray-500">No production data available</p>
        </CardContent>
      </Card>
    );
  }

  const handleStatusUpdate = (connectId: string, newStatus: string) => {
    updateStatusMutation.mutate({
      connectId,
      productionStatus: newStatus
    });
  };

  const handleConnectClick = (connect: any) => {
    setSelectedConnect(connect);
    setConnectModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Daily Production Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Daily Production Status - {targetDate.toLocaleDateString()}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Real-time status of your AOI appointments, press sales, and other connects
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Connects */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Total Connects
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Today
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {productionData.totalConnects}
              </Badge>
            </div>

            {/* Confirmed Appointments */}
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Confirmed
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Appointments
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {productionData.confirmedAppointments}
              </Badge>
            </div>

            {/* Completed Sales */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    Sales
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Completed
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                {productionData.completedSales}
              </Badge>
            </div>

            {/* Pending Follow-ups */}
            <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Pending
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Follow-ups
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {productionData.pendingFollowUps}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connect Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AOI Appointments */}
        {productionData.aoiAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                AOI Appointments ({productionData.aoiAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productionData.aoiAppointments.slice(0, 3).map((connect: any) => (
                <div 
                  key={connect.id} 
                  onClick={() => handleConnectClick(connect)}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="font-medium">{connect.leadName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {connect.leadPhone} • {connect.connectTime}
                    </p>
                    {connect.immediateOutcome && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {connect.immediateOutcome}
                      </p>
                    )}
                  </div>
                  <Badge className={productionStatusColors[connect.productionStatus as keyof typeof productionStatusColors]}>
                    {connect.productionStatus || 'pending'}
                  </Badge>
                </div>
              ))}
              {productionData.aoiAppointments.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{productionData.aoiAppointments.length - 3} more appointments
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Press Sales */}
        {productionData.pressSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Press Sales ({productionData.pressSales.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productionData.pressSales.slice(0, 3).map((connect: any) => (
                <div 
                  key={connect.id} 
                  onClick={() => handleConnectClick(connect)}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="font-medium">{connect.leadName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {connect.leadPhone} • {connect.connectTime}
                    </p>
                    {connect.immediateOutcome && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {connect.immediateOutcome}
                      </p>
                    )}
                  </div>
                  <Badge className={productionStatusColors[connect.productionStatus as keyof typeof productionStatusColors]}>
                    {connect.productionStatus || 'pending'}
                  </Badge>
                </div>
              ))}
              {productionData.pressSales.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{productionData.pressSales.length - 3} more sales
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instant Presentations */}
        {productionData.instantPresentations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Instant Presentations ({productionData.instantPresentations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productionData.instantPresentations.slice(0, 3).map((connect: any) => (
                <div 
                  key={connect.id} 
                  onClick={() => handleConnectClick(connect)}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="font-medium">{connect.leadName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {connect.leadPhone} • {connect.connectTime}
                    </p>
                    {connect.immediateOutcome && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {connect.immediateOutcome}
                      </p>
                    )}
                  </div>
                  <Badge className={productionStatusColors[connect.productionStatus as keyof typeof productionStatusColors]}>
                    {connect.productionStatus || 'pending'}
                  </Badge>
                </div>
              ))}
              {productionData.instantPresentations.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{productionData.instantPresentations.length - 3} more presentations
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scheduled Callbacks */}
        {productionData.callbacks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Scheduled Callbacks ({productionData.callbacks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productionData.callbacks.slice(0, 3).map((connect: any) => (
                <div 
                  key={connect.id} 
                  onClick={() => handleConnectClick(connect)}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="font-medium">{connect.leadName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {connect.leadPhone} • {connect.connectTime}
                    </p>
                    {connect.immediateOutcome && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {connect.immediateOutcome}
                      </p>
                    )}
                  </div>
                  <Badge className={productionStatusColors[connect.productionStatus as keyof typeof productionStatusColors]}>
                    {connect.productionStatus || 'pending'}
                  </Badge>
                </div>
              ))}
              {productionData.callbacks.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{productionData.callbacks.length - 3} more callbacks
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* No Connects Message */}
      {productionData.totalConnects === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Phone className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Connects Today
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Start making calls to track your daily AOI appointments, press sales, and other connects.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Connect Type Modal */}
      <ConnectTypeModal
        isOpen={connectModalOpen}
        onClose={() => {
          setConnectModalOpen(false);
          setSelectedConnect(null);
        }}
        connect={selectedConnect}
      />
    </div>
  );
}