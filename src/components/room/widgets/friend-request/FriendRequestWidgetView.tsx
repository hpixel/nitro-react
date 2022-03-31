import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { RoomObjectCategory, RoomObjectUserType } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useState } from 'react';
import { LocalizeText, MessengerRequest, RoomWidgetUpdateRoomObjectEvent } from '../../../../api';
import { Base, Button, Column, Flex, Text } from '../../../../common';
import { UseEventDispatcherHook, useFriends } from '../../../../hooks';
import { useRoomContext } from '../../RoomContext';
import { ObjectLocationView } from '../object-location/ObjectLocationView';

export const FriendRequestWidgetView: FC<{}> = props =>
{
    const [ displayedRequests, setDisplayedRequests ] = useState<{ roomIndex: number, request: MessengerRequest }[]>([]);
    const [ dismissedRequestIds, setDismissedRequestIds ] = useState<number[]>([]);
    const { roomSession = null, eventDispatcher = null } = useRoomContext();
    const { requests = [], requestResponse = null } = useFriends();

    const hideFriendRequest = (userId: number) =>
    {
        setDismissedRequestIds(prevValue =>
            {
                if(prevValue.indexOf(userId) >= 0) return prevValue;

                const newValue = [ ...prevValue ];

                newValue.push(userId);

                return newValue;
            });
    }

    const onRoomWidgetUpdateRoomObjectEvent = useCallback((event: RoomWidgetUpdateRoomObjectEvent) =>
    {
        if(event.category !== RoomObjectCategory.UNIT) return;
        
        const userData = roomSession.userDataManager.getUserDataByIndex(event.id);

        if(userData && (userData.type === RoomObjectUserType.getTypeNumber(RoomObjectUserType.USER)))
        {
            if(event.type === RoomWidgetUpdateRoomObjectEvent.USER_ADDED)
            {
                const request = requests.find(request => (request.requesterUserId === userData.webID));

                if(!request || displayedRequests.find(request => (request.request.requesterUserId === userData.webID))) return;

                const newValue = [ ...displayedRequests ];

                newValue.push({ roomIndex: userData.roomIndex, request });

                setDisplayedRequests(newValue);
            }

            return;
        }

        if(event.type === RoomWidgetUpdateRoomObjectEvent.USER_REMOVED)
        {
            const index = displayedRequests.findIndex(request => (request.roomIndex === event.id));

            if(index === -1) return;

            const newValue = [ ...displayedRequests ];

            newValue.splice(index, 1);

            setDisplayedRequests(newValue);
        }
    }, [ roomSession, requests, displayedRequests ]);

    UseEventDispatcherHook(RoomWidgetUpdateRoomObjectEvent.USER_ADDED, eventDispatcher, onRoomWidgetUpdateRoomObjectEvent);
    UseEventDispatcherHook(RoomWidgetUpdateRoomObjectEvent.USER_REMOVED, eventDispatcher, onRoomWidgetUpdateRoomObjectEvent);

    useEffect(() =>
    {
        if(!requests || !requests.length) return;

        const newDisplayedRequests: { roomIndex: number, request: MessengerRequest }[] = [];

        for(const request of requests)
        {
            const userData = roomSession.userDataManager.getUserData(request.requesterUserId);

            if(!userData) continue;

            newDisplayedRequests.push({ roomIndex: userData.roomIndex, request });
        }

        setDisplayedRequests(newDisplayedRequests);
    }, [ roomSession, requests ]);

    if(!requests.length) return null;

    const FriendRequestDialogView: FC<{ roomIndex: number, request: MessengerRequest }> = props =>
    {
        const { roomIndex = -1, request = null } = props;

        return (
            <ObjectLocationView objectId={ roomIndex } category={ RoomObjectCategory.UNIT }>
                <Base className="nitro-friend-request-dialog nitro-context-menu p-2">
                    <Column>
                        <Flex alignItems="center" justifyContent="between" gap={ 2 }>
                            <Text variant="white" fontSize={ 6 }>{ LocalizeText('widget.friendrequest.from', [ 'username' ], [ request.name ]) }</Text>
                            <FontAwesomeIcon icon="times" className="cursor-pointer" onClick={ event => hideFriendRequest(request.requesterUserId) } />
                        </Flex>
                        <Flex justifyContent="end" gap={ 1 }>
                            <Button variant="danger" onClick={ event => requestResponse(request.requesterUserId, false) }>{ LocalizeText('widget.friendrequest.decline') }</Button>
                            <Button variant="success" onClick={ event => requestResponse(request.requesterUserId, true) }>{ LocalizeText('widget.friendrequest.accept') }</Button>
                        </Flex>
                    </Column>
                </Base>
            </ObjectLocationView>
        );
    }

    return (
        <>
            { displayedRequests.map((request, index) =>
                {
                    if(dismissedRequestIds.indexOf(request.request.requesterUserId) >= 0) return null;

                    return <FriendRequestDialogView key={ index } roomIndex={ request.roomIndex } request={ request.request } />;
                }) }
        </>
    );
}
