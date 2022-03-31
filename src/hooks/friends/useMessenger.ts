import { NewConsoleMessageEvent, RoomInviteErrorEvent, RoomInviteEvent, SendMessageComposer as SendMessageComposerPacket } from '@nitrots/nitro-renderer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBetween } from 'use-between';
import { CloneObject, GetSessionDataManager, LocalizeText, MessengerIconState, MessengerThread, MessengerThreadChat, NotificationAlertType, NotificationUtilities, PlaySound, SendMessageComposer, SoundNames } from '../../api';
import { UseMessageEventHook } from '../messages';
import { useFriends } from './useFriends';

const useMessengerState = () =>
{
    const [ messageThreads, setMessageThreads ] = useState<MessengerThread[]>([]);
    const [ activeThreadId, setActiveThreadId ] = useState<number>(-1);
    const [ hiddenThreadIds, setHiddenThreadIds ] = useState<number[]>([]);
    const [ iconState, setIconState ] = useState<number>(MessengerIconState.HIDDEN);
    const { getFriend = null } = useFriends();

    const visibleThreads = useMemo(() => messageThreads.filter(thread => (hiddenThreadIds.indexOf(thread.threadId) === -1)), [ messageThreads, hiddenThreadIds ]);
    const activeThread = useMemo(() => ((activeThreadId > 0) && visibleThreads.find(thread => (thread.threadId === activeThreadId) || null)), [ activeThreadId, visibleThreads ]);

    const getMessageThread = useCallback((userId: number) =>
    {
        let thread = messageThreads.find(thread => (thread.participant && (thread.participant.id === userId)));

        if(thread) return thread;
        
        const friend = getFriend(userId);

        if(!friend) return null;

        thread = new MessengerThread(friend);

        setMessageThreads(prevValue =>
            {
                const newValue = [ ...prevValue ];

                newValue.push(thread);

                return newValue;
            });
            
        setHiddenThreadIds(prevValue =>
            {
                const index = prevValue.indexOf(thread.threadId);

                if(index === -1) return prevValue;

                const newValue = [ ...prevValue ];

                newValue.splice(index, 1);

                return newValue;
            });

        return thread;
    }, [ messageThreads, getFriend ]);

    const setActiveThread = useCallback((thread: MessengerThread) =>
    {
        if(!thread)
        {
            setActiveThreadId(-1);

            return;
        }
        
        setMessageThreads(prevValue =>
            {
                const newValue = [ ...prevValue ];
                const index = newValue.findIndex(newThread => (newThread.threadId === thread.threadId));

                if(index === -1) return prevValue;

                const newThread = CloneObject(newValue[index]);

                newValue[index] = newThread;

                newThread.setRead();

                return newValue;
            });

        setActiveThreadId(thread.threadId);
    }, []);

    const closeThread = (threadId: number) =>
    {
        setHiddenThreadIds(prevValue =>
            {
                const newValue = [ ...prevValue ];

                if(newValue.indexOf(threadId) >= 0) return prevValue;

                newValue.push(threadId);

                return newValue;
            });
    }

    const sendMessage = (thread: MessengerThread, text: string) =>
    {
        if(!thread || !text || !text.length) return;

        SendMessageComposer(new SendMessageComposerPacket(thread.participant.id, text));

        if((messageThreads.length === 1) && (thread.groups.length === 1)) PlaySound(SoundNames.MESSENGER_NEW_THREAD);

        setMessageThreads(prevValue =>
            {
                const newValue = [ ...prevValue ];
                const index = newValue.findIndex(newThread => (newThread.threadId === thread.threadId));

                if(index === -1) return prevValue;

                const newThread = CloneObject(newValue[index]);

                newValue[index] = newThread;

                newThread.addMessage(GetSessionDataManager().userId, text, 0, null, MessengerThreadChat.CHAT);

                if(activeThreadId === newThread.threadId) newThread.setRead();

                return newValue;
            });
    }

    const onNewConsoleMessageEvent = useCallback((event: NewConsoleMessageEvent) =>
    {
        const parser = event.getParser();
        const thread = getMessageThread(parser.senderId);

        if(!thread) return;

        setMessageThreads(prevValue =>
            {
                const newValue = [ ...prevValue ];
                const index = newValue.findIndex(newThread => (newThread.threadId === thread.threadId));

                if(index === -1) return prevValue;

                const newThread = CloneObject(newValue[index]);

                newValue[index] = newThread;

                newThread.addMessage(parser.senderId, parser.messageText, parser.secondsSinceSent, parser.extraData);

                if(activeThreadId === newThread.threadId) newThread.setRead();

                if(newThread.unreadCount > 0) PlaySound(SoundNames.MESSENGER_MESSAGE_RECEIVED);

                return newValue;
            });
    }, [ activeThreadId, getMessageThread ]);

    UseMessageEventHook(NewConsoleMessageEvent, onNewConsoleMessageEvent);

    const onRoomInviteEvent = useCallback((event: RoomInviteEvent) =>
    {
        const parser = event.getParser();
        const thread = getMessageThread(parser.senderId);

        if(!thread) return;

        setMessageThreads(prevValue =>
            {
                const newValue = [ ...prevValue ];
                const index = newValue.findIndex(newThread => (newThread.threadId === thread.threadId));

                if(index === -1) return prevValue;

                const newThread = CloneObject(newValue[index]);

                newValue[index] = newThread;

                newThread.addMessage(null, parser.messageText, 0, null, MessengerThreadChat.ROOM_INVITE);

                if(activeThreadId === newThread.threadId) newThread.setRead();

                if(newThread.unreadCount > 0) PlaySound(SoundNames.MESSENGER_MESSAGE_RECEIVED);

                return newValue;
            });
    }, [ activeThreadId, getMessageThread ]);

    UseMessageEventHook(RoomInviteEvent, onRoomInviteEvent);

    const onRoomInviteErrorEvent = useCallback((event: RoomInviteErrorEvent) =>
    {
        const parser = event.getParser();
        const message = ((('Received room invite error: errorCode: ' + parser.errorCode) + ', recipients: ') + parser.failedRecipients);
            
        NotificationUtilities.simpleAlert(message, NotificationAlertType.DEFAULT, null, null, LocalizeText('friendlist.alert.title'));
    }, []);

    UseMessageEventHook(RoomInviteErrorEvent, onRoomInviteErrorEvent);

    useEffect(() =>
    {
        setIconState(prevValue =>
            {
                if(!visibleThreads.length) return MessengerIconState.HIDDEN;

                let isUnread = false;

                for(const thread of visibleThreads)
                {
                    if(thread.unreadCount > 0)
                    {
                        isUnread = true;

                        break;
                    }
                }

                if(isUnread) return MessengerIconState.UNREAD;

                return MessengerIconState.SHOW;
            });
    }, [ visibleThreads ]);

    return { messageThreads, activeThread, iconState, visibleThreads, getMessageThread, setActiveThread, closeThread, sendMessage };
}

export const useMessenger = () => useBetween(useMessengerState);
