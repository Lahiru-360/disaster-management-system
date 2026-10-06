import { useNavigate } from 'react-router';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// The sidebar's Hazard Warnings page: where an officer opens "Issue Hazard
// Warning" (UC01 step 1). A list of issued warnings has no endpoint yet.
export default function HazardWarningsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  return (
    <Screen>
      <ScreenHeader
        title="Hazard Warnings"
        rightSlot={
          canIssue ? (
            <Button fullWidth={false} onClick={() => navigate('/hazard-warnings/new')}>
              Issue Hazard Warning
            </Button>
          ) : null
        }
      />
      <Card className="mt-6">
        <EmptyState
          icon="!"
          title="No warning open"
          description={
            canIssue
              ? 'Issue a hazard warning to alert the citizens of a district or river basin.'
              : 'Hazard warnings are issued by DMC and duty officers.'
          }
        />
      </Card>
    </Screen>
  );
}
