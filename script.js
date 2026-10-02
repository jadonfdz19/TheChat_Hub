/* =========================================================
   CHAT HUB
   SUPABASE + PRIVATE CHAT + GROUP CHAT
   ========================================================= */


/* =========================================================
   SUPABASE CONNECTION
   ========================================================= */

const SUPABASE_URL =
    "https://tqedgpapfslnhxavlivu.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_6bWIsy2wN0L6k1ocp6eOQA_AMITaJLe";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let currentUser = null;

let currentProfile = null;

let currentConversation = null;

let currentGroup = null;

let realtimeChannel = null;

let renderedMessageIds =
    new Set();

let notificationContainer = null;


/* =========================================================
   SHOW LOGIN
   ========================================================= */

function showLogin() {

    document.getElementById(
        "loginForm"
    ).style.display = "block";

    document.getElementById(
        "signupForm"
    ).style.display = "none";
}


/* =========================================================
   SHOW SIGNUP
   ========================================================= */

function showSignup() {

    document.getElementById(
        "loginForm"
    ).style.display = "none";

    document.getElementById(
        "signupForm"
    ).style.display = "block";
}


/* =========================================================
   SIGN UP
   ========================================================= */

async function signup() {

    const name =
        document.getElementById(
            "signupName"
        ).value.trim();

    const email =
        document.getElementById(
            "signupEmail"
        ).value.trim()
        .toLowerCase();

    const password =
        document.getElementById(
            "signupPassword"
        ).value;


    if (!name) {

        alert(
            "Please enter your name."
        );

        return;
    }


    if (!email) {

        alert(
            "Please enter your email address."
        );

        return;
    }


    if (!password) {

        alert(
            "Please enter a password."
        );

        return;
    }


    if (password.length < 6) {

        alert(
            "Password must be at least 6 characters."
        );

        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {
                        name: name
                    }

                }

            });


        if (error) {

            console.error(
                "SIGNUP ERROR:",
                error
            );

            alert(
                "Could not create account: " +
                error.message
            );

            return;
        }


        /*
         * If Supabase immediately gives us
         * a session, create the profile now.
         */

        if (data.session) {

            currentUser =
                data.user;

            await ensureProfile(
                name,
                email
            );

            await showChatScreen();

            return;
        }


        /*
         * If email confirmation is enabled,
         * Supabase will not give a session yet.
         */

        alert(
            "Account created successfully!\n\n" +
            "Please check your email and confirm your account, " +
            "then sign in to Chat Hub."
        );

        showLogin();

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        alert(
            "Something went wrong while creating your account."
        );
    }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

    const email =
        document.getElementById(
            "loginEmail"
        ).value.trim()
        .toLowerCase();

    const password =
        document.getElementById(
            "loginPassword"
        ).value;


    if (!email || !password) {

        alert(
            "Please enter your email and password."
        );

        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword({

                email: email,

                password: password

            });


        if (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            alert(
                "Login failed: " +
                error.message
            );

            return;
        }


        currentUser =
            data.user;


        await showChatScreen();

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        alert(
            "Something went wrong while signing in."
        );
    }
}


/* =========================================================
   ENSURE PROFILE EXISTS
   ========================================================= */

async function ensureProfile(
    name,
    email
) {

    if (!currentUser) {
        return;
    }


    const {
        data: existingProfile,
        error: selectError
    } =
        await supabaseClient
            .from("profiles")
            .select(
                "id,name,email,created_at"
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


    if (selectError) {

        console.error(
            "PROFILE LOOKUP ERROR:",
            selectError
        );

        return;
    }


    if (existingProfile) {

        currentProfile =
            existingProfile;

        return;
    }


    const {
        data: newProfile,
        error: insertError
    } =
        await supabaseClient
            .from("profiles")
            .insert({

                id: currentUser.id,

                name:
                    name ||
                    currentUser.user_metadata?.name ||
                    "User",

                email:
                    email ||
                    currentUser.email

            })
            .select()
            .single();


    if (insertError) {

        console.error(
            "PROFILE CREATE ERROR:",
            insertError
        );

        return;
    }


    currentProfile =
        newProfile;
}


/* =========================================================
   SHOW CHAT SCREEN
   ========================================================= */

async function showChatScreen() {

    document.getElementById(
        "authScreen"
    ).style.display = "none";

    document.getElementById(
        "chatScreen"
    ).style.display = "flex";


    await loadProfile();

    await loadConversations();

    await loadGroups();

    setupNotificationContainer();

    subscribeToRealtime();


    document.getElementById(
        "messageInput"
    ).disabled = true;

    document.getElementById(
        "sendButton"
    ).disabled = true;
}


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select(
                "id,name,email,created_at"
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.error(
            "LOAD PROFILE ERROR:",
            error
        );

        /*
         * We still try to create the profile
         * using the Auth user's information.
         */

        await ensureProfile(
            currentUser.user_metadata?.name ||
                "User",

            currentUser.email
        );

    } else if (data) {

        currentProfile =
            data;

    } else {

        await ensureProfile(
            currentUser.user_metadata?.name ||
                "User",

            currentUser.email
        );
    }


    const name =
        currentProfile?.name ||
        currentUser.user_metadata?.name ||
        "User";


    document.getElementById(
        "currentUserName"
    ).textContent = name;
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        await cleanupRealtime();

        await supabaseClient.auth.signOut();

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }


    currentUser = null;

    currentProfile = null;

    currentConversation = null;

    currentGroup = null;

    renderedMessageIds.clear();


    document.getElementById(
        "chatScreen"
    ).style.display = "none";

    document.getElementById(
        "authScreen"
    ).style.display = "flex";


    document.getElementById(
        "loginEmail"
    ).value = "";

    document.getElementById(
        "loginPassword"
    ).value = "";

    showLogin();
}


/* =========================================================
   CHECK CURRENT USER
   ========================================================= */

async function checkUser() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "SESSION ERROR:",
                error
            );

            return;
        }


        if (data.session) {

            currentUser =
                data.session.user;

            await showChatScreen();

        }

    } catch (error) {

        console.error(
            "CHECK USER ERROR:",
            error
        );
    }
}


/* =========================================================
   NOTIFICATION CONTAINER
   ========================================================= */

function setupNotificationContainer() {

    if (
        document.getElementById(
            "notificationContainer"
        )
    ) {

        notificationContainer =
            document.getElementById(
                "notificationContainer"
            );

        return;
    }


    notificationContainer =
        document.createElement(
            "div"
        );

    notificationContainer.id =
        "notificationContainer";

    notificationContainer.className =
        "notification-container";

    document.body.appendChild(
        notificationContainer
    );
}


/* =========================================================
   SHOW IN-APP NOTIFICATION
   ========================================================= */

function showNotification(
    title,
    message,
    type = "received",
    action = null
) {

    setupNotificationContainer();


    const notification =
        document.createElement(
            "div"
        );

    notification.className =
        "chat-notification";


    const titleElement =
        document.createElement(
            "strong"
        );

    titleElement.textContent =
        title;


    const messageElement =
        document.createElement(
            "span"
        );

    messageElement.textContent =
        message;


    notification.appendChild(
        titleElement
    );

    notification.appendChild(
        messageElement
    );


    if (action) {

        notification.onclick =
            function() {

                notification.remove();

                action();
            };

    }


    notificationContainer.appendChild(
        notification
    );


    setTimeout(
        function() {

            if (
                notification.parentNode
            ) {

                notification.remove();
            }

        },
        5000
    );
}


/* =========================================================
   PRIVATE CONVERSATIONS
   ========================================================= */

async function loadConversations() {

    if (!currentUser) {
        return;
    }


    const privateChats =
        document.getElementById(
            "privateChats"
        );


    privateChats.innerHTML = "";


    const {
        data: conversations,
        error
    } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .or(
                `user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "LOAD CONVERSATIONS ERROR:",
            error
        );

        privateChats.innerHTML =
            '<div class="empty-conversations">Could not load conversations.</div>';

        return;
    }


    if (
        !conversations ||
        conversations.length === 0
    ) {

        privateChats.innerHTML =
            '<div class="empty-conversations">No conversations yet.</div>';

        return;
    }


    for (
        const conversation
        of conversations
    ) {

        const otherUserId =
            conversation.user1_id ===
            currentUser.id

                ? conversation.user2_id

                : conversation.user1_id;


        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,name,email"
                )
                .eq(
                    "id",
                    otherUserId
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "PROFILE ERROR:",
                profileError
            );

            continue;
        }


        if (!profile) {
            continue;
        }


        createPrivateConversationItem(
            conversation,
            profile
        );
    }
}


/* =========================================================
   CREATE PRIVATE CHAT ITEM
   ========================================================= */

function createPrivateConversationItem(
    conversation,
    profile
) {

    const privateChats =
        document.getElementById(
            "privateChats"
        );


    const item =
        document.createElement(
            "button"
        );

    item.className =
        "conversation-item";


    item.dataset.search =
        (
            profile.name +
            " " +
            profile.email
        ).toLowerCase();


    if (
        currentConversation &&
        currentConversation.id ===
            conversation.id
    ) {

        item.classList.add(
            "active"
        );
    }


    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "avatar";

    avatar.textContent =
        "👤";


    const info =
        document.createElement(
            "div"
        );

    info.className =
        "conversation-info";


    const name =
        document.createElement(
            "strong"
        );

    name.textContent =
        profile.name ||
        "User";


    const email =
        document.createElement(
            "small"
        );

    email.textContent =
        profile.email;


    info.appendChild(name);

    info.appendChild(email);


    item.appendChild(avatar);

    item.appendChild(info);


    item.onclick =
        function() {

            openPrivateChat(
                conversation,
                profile
            );
        };


    privateChats.appendChild(
        item
    );
}


/* =========================================================
   NEW PRIVATE CONVERSATION
   ========================================================= */

async function newConversation() {

    if (!currentUser) {
        return;
    }


    const email =
        prompt(
            "Enter the email address of the person you want to chat with:"
        );


    if (!email) {
        return;
    }


    const cleanEmail =
        email.trim().toLowerCase();


    if (
        currentProfile &&
        cleanEmail ===
            currentProfile.email.toLowerCase()
    ) {

        alert(
            "You cannot start a conversation with yourself."
        );

        return;
    }


    const {
        data: profile,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select(
                "id,name,email"
            )
            .ilike(
                "email",
                cleanEmail
            )
            .maybeSingle();


    if (error) {

        console.error(
            "FIND USER ERROR:",
            error
        );

        alert(
            "Could not search for that user: " +
            error.message
        );

        return;
    }


    if (!profile) {

        alert(
            "No user with that email was found."
        );

        return;
    }


    const {
        data: existingConversation,
        error: conversationSearchError
    } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .or(
                `and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`
            )
            .maybeSingle();


    if (conversationSearchError) {

        console.error(
            "CONVERSATION SEARCH ERROR:",
            conversationSearchError
        );

        alert(
            "Could not check for existing conversation."
        );

        return;
    }


    let conversation =
        existingConversation;


    if (!conversation) {

        const {
            data: newConversationData,
            error: createError
        } =
            await supabaseClient
                .from("conversations")
                .insert({

                    user1_id:
                        currentUser.id,

                    user2_id:
                        profile.id

                })
                .select()
                .single();


        if (createError) {

            console.error(
                "CREATE CONVERSATION ERROR:",
                createError
            );

            alert(
                "Could not create conversation: " +
                createError.message
            );

            return;
        }


        conversation =
            newConversationData;
    }


    await loadConversations();


    openPrivateChat(
        conversation,
        profile
    );
}


/* =========================================================
   OPEN PRIVATE CHAT
   ========================================================= */

async function openPrivateChat(
    conversation,
    profile
) {

    currentConversation =
        conversation;

    currentGroup = null;

    renderedMessageIds.clear();


    document.getElementById(
        "conversationName"
    ).textContent =
        profile.name ||
        "User";


    document.getElementById(
        "conversationStatus"
    ).textContent =
        profile.email;


    document.getElementById(
        "conversationAvatar"
    ).textContent =
        "👤";


    removeGroupControls();


    enableMessageInput();


    await loadMessages();


    highlightActiveConversation(
        conversation.id,
        "private"
    );
}


/* =========================================================
   HIGHLIGHT ACTIVE CONVERSATION
   ========================================================= */

function highlightActiveConversation(
    id,
    type
) {

    document
        .querySelectorAll(
            ".conversation-item"
        )
        .forEach(
            item => {
                item.classList.remove(
                    "active"
                );
            }
        );


    const items =
        document.querySelectorAll(
            ".conversation-item"
        );


    items.forEach(item => {

        if (
            type === "private" &&
            item.dataset.conversationId ===
                String(id)
        ) {

            item.classList.add(
                "active"
            );
        }


        if (
            type === "group" &&
            item.dataset.groupId ===
                String(id)
        ) {

            item.classList.add(
                "active"
            );
        }

    });
}


/* =========================================================
   ENABLE MESSAGE INPUT
   ========================================================= */

function enableMessageInput() {

    document.getElementById(
        "messageInput"
    ).disabled = false;

    document.getElementById(
        "sendButton"
    ).disabled = false;


    document.getElementById(
        "messageInput"
    ).focus();
}


/* =========================================================
   LOAD PRIVATE MESSAGES
   ========================================================= */

async function loadMessages() {

    if (
        !currentUser ||
        !currentConversation
    ) {

        return;
    }


    const messagesBox =
        document.getElementById(
            "messages"
        );


    messagesBox.innerHTML = "";

    renderedMessageIds.clear();


    const {
        data: messages,
        error
    } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "LOAD MESSAGES ERROR:",
            error
        );

        messagesBox.innerHTML =
            '<div class="empty-conversations">Unable to load messages.</div>';

        return;
    }


    if (
        !messages ||
        messages.length === 0
    ) {

        messagesBox.innerHTML =
            '<div class="welcome-panel">' +
            '<div class="welcome-icon">✦</div>' +
            '<h2>Start the conversation</h2>' +
            '<p>Send your first message.</p>' +
            '</div>';

        return;
    }


    messages.forEach(
        message => {
            displayMessage(message);
        }
    );


    scrollMessagesToBottom();
}


/* =========================================================
   SCROLL TO BOTTOM
   ========================================================= */

function scrollMessagesToBottom() {

    const messagesBox =
        document.getElementById(
            "messages"
        );

    if (!messagesBox) {
        return;
    }


    setTimeout(
        function() {

            messagesBox.scrollTop =
                messagesBox.scrollHeight;

        },
        50
    );
}
/* =========================================================
   GROUP CHAT
   ========================================================= */


/* =========================================================
   CREATE NEW GROUP
   ========================================================= */

async function newGroup() {

    if (!currentUser) {
        return;
    }


    const groupName =
        prompt(
            "Enter a name for the group:"
        );


    if (!groupName) {
        return;
    }


    const cleanName =
        groupName.trim();


    if (!cleanName) {

        alert(
            "Please enter a group name."
        );

        return;
    }


    /* -----------------------------------------
       CREATE GROUP
       ----------------------------------------- */

    const {
        data: group,
        error: groupError
    } =
        await supabaseClient
            .from("groups")
            .insert({

                name: cleanName,

                created_by:
                    currentUser.id

            })
            .select()
            .single();


    if (groupError) {

        console.error(
            "CREATE GROUP ERROR:",
            groupError
        );

        alert(
            "Could not create group: " +
            groupError.message
        );

        return;
    }


    /* -----------------------------------------
       ADD CREATOR AS FIRST MEMBER
       ----------------------------------------- */

    const {
        error: memberError
    } =
        await supabaseClient
            .from("group_members")
            .insert({

                group_id:
                    group.id,

                user_id:
                    currentUser.id

            });


    if (memberError) {

        console.error(
            "ADD GROUP CREATOR ERROR:",
            memberError
        );

        alert(
            "Group was created, but you could not be added as a member: " +
            memberError.message
        );

        return;
    }


    await loadGroups();


    alert(
        "Group created successfully!"
    );


    openGroupChat(group);
}


/* =========================================================
   LOAD GROUPS
   ========================================================= */

async function loadGroups() {

    if (!currentUser) {
        return;
    }


    const groupChats =
        document.getElementById(
            "groupChats"
        );


    groupChats.innerHTML = "";


    /* -----------------------------------------
       Find groups where current user is a member
       ----------------------------------------- */

    const {
        data: memberships,
        error: membershipError
    } =
        await supabaseClient
            .from("group_members")
            .select(
                "group_id"
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (membershipError) {

        console.error(
            "LOAD GROUP MEMBERSHIPS ERROR:",
            membershipError
        );

        groupChats.innerHTML =
            '<div class="empty-conversations">Could not load groups.</div>';

        return;
    }


    if (
        !memberships ||
        memberships.length === 0
    ) {

        groupChats.innerHTML =
            '<div class="empty-conversations">No groups yet.</div>';

        return;
    }


    for (
        const membership
        of memberships
    ) {

        const {
            data: group,
            error: groupError
        } =
            await supabaseClient
                .from("groups")
                .select("*")
                .eq(
                    "id",
                    membership.group_id
                )
                .maybeSingle();


        if (groupError) {

            console.error(
                "LOAD GROUP ERROR:",
                groupError
            );

            continue;
        }


        if (!group) {
            continue;
        }


        createGroupItem(group);
    }
}


/* =========================================================
   CREATE GROUP ITEM
   ========================================================= */

function createGroupItem(group) {

    const groupChats =
        document.getElementById(
            "groupChats"
        );


    const item =
        document.createElement(
            "button"
        );


    item.className =
        "conversation-item";


    item.dataset.groupId =
        group.id;


    item.dataset.search =
        (
            group.name || ""
        ).toLowerCase();


    if (
        currentGroup &&
        currentGroup.id ===
            group.id
    ) {

        item.classList.add(
            "active"
        );
    }


    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "avatar";

    avatar.textContent =
        "👥";


    const info =
        document.createElement(
            "div"
        );

    info.className =
        "conversation-info";


    const name =
        document.createElement(
            "strong"
        );

    name.textContent =
        group.name;


    const small =
        document.createElement(
            "small"
        );

    small.textContent =
        "Group chat";


    info.appendChild(name);

    info.appendChild(small);


    item.appendChild(avatar);

    item.appendChild(info);


    item.onclick =
        function() {

            openGroupChat(group);

        };


    groupChats.appendChild(
        item
    );
}


/* =========================================================
   OPEN GROUP CHAT
   ========================================================= */

async function openGroupChat(
    group
) {

    if (!group) {
        return;
    }


    currentGroup =
        group;

    currentConversation =
        null;

    renderedMessageIds.clear();


    document.getElementById(
        "conversationName"
    ).textContent =
        group.name;


    document.getElementById(
        "conversationStatus"
    ).textContent =
        "Group chat";


    document.getElementById(
        "conversationAvatar"
    ).textContent =
        "👥";


    createGroupControls();


    enableMessageInput();


    await loadGroupMembers();


    await loadGroupMessages();


    highlightActiveConversation(
        group.id,
        "group"
    );
}


/* =========================================================
   CREATE GROUP CONTROLS
   ========================================================= */

function createGroupControls() {

    const controls =
        document.getElementById(
            "groupControls"
        );


    controls.innerHTML = "";

    controls.style.display =
        "flex";


    /* -----------------------------------------
       ADD MEMBER
       ----------------------------------------- */

    const addButton =
        document.createElement(
            "button"
        );

    addButton.className =
        "group-control-button";

    addButton.textContent =
        "＋ Add member";

    addButton.onclick =
        function() {

            addGroupMember();

        };


    /* -----------------------------------------
       MEMBERS
       ----------------------------------------- */

    const membersButton =
        document.createElement(
            "button"
        );

    membersButton.className =
        "group-control-button";

    membersButton.textContent =
        "👥 Members";

    membersButton.onclick =
        function() {

            showMembersBox();

        };


    controls.appendChild(
        addButton
    );

    controls.appendChild(
        membersButton
    );


    /* -----------------------------------------
       DELETE GROUP
       ----------------------------------------- */

    if (
        currentGroup &&
        currentGroup.created_by ===
            currentUser.id
    ) {

        const deleteButton =
            document.createElement(
                "button"
            );

        deleteButton.className =
            "group-control-button danger";

        deleteButton.textContent =
            "🗑 Delete group";

        deleteButton.onclick =
            function() {

                deleteCurrentGroup();

            };


        controls.appendChild(
            deleteButton
        );
    }
}


/* =========================================================
   REMOVE GROUP CONTROLS
   ========================================================= */

function removeGroupControls() {

    const controls =
        document.getElementById(
            "groupControls"
        );


    const membersBox =
        document.getElementById(
            "groupMembersBox"
        );


    controls.innerHTML = "";

    controls.style.display =
        "none";


    membersBox.innerHTML = "";

    membersBox.style.display =
        "none";
}


/* =========================================================
   ADD GROUP MEMBER
   ========================================================= */

async function addGroupMember() {

    if (
        !currentUser ||
        !currentGroup
    ) {

        return;
    }


    const email =
        prompt(
            "Enter the email address of the person you want to add:"
        );


    if (!email) {
        return;
    }


    const cleanEmail =
        email.trim().toLowerCase();


    /* -----------------------------------------
       Find profile
       ----------------------------------------- */

    const {
        data: profile,
        error: profileError
    } =
        await supabaseClient
            .from("profiles")
            .select(
                "id,name,email"
            )
            .ilike(
                "email",
                cleanEmail
            )
            .maybeSingle();


    if (profileError) {

        console.error(
            "FIND GROUP MEMBER ERROR:",
            profileError
        );

        alert(
            "Could not find that user: " +
            profileError.message
        );

        return;
    }


    if (!profile) {

        alert(
            "No user with that email was found."
        );

        return;
    }


    if (
        profile.id ===
        currentUser.id
    ) {

        alert(
            "You are already in this group."
        );

        return;
    }


    /* -----------------------------------------
       Check if already a member
       ----------------------------------------- */

    const {
        data: existingMember,
        error: existingError
    } =
        await supabaseClient
            .from("group_members")
            .select(
                "group_id,user_id"
            )
            .eq(
                "group_id",
                currentGroup.id
            )
            .eq(
                "user_id",
                profile.id
            )
            .maybeSingle();


    if (existingError) {

        console.error(
            "CHECK GROUP MEMBER ERROR:",
            existingError
        );

        alert(
            "Could not check group membership."
        );

        return;
    }


    if (existingMember) {

        alert(
            profile.name +
            " is already a member of this group."
        );

        return;
    }


    /* -----------------------------------------
       Add member
       ----------------------------------------- */

    const {
        error: insertError
    } =
        await supabaseClient
            .from("group_members")
            .insert({

                group_id:
                    currentGroup.id,

                user_id:
                    profile.id

            });


    if (insertError) {

        console.error(
            "ADD GROUP MEMBER ERROR:",
            insertError
        );

        alert(
            "Could not add member: " +
            insertError.message
        );

        return;
    }


    alert(
        profile.name +
        " was added to the group."
    );


    await loadGroupMembers();

    showMembersBox();
}


/* =========================================================
   LOAD GROUP MEMBERS
   ========================================================= */

async function loadGroupMembers() {

    if (
        !currentGroup ||
        !currentUser
    ) {

        return [];
    }


    const {
        data: memberships,
        error
    } =
        await supabaseClient
            .from("group_members")
            .select(
                "group_id,user_id,joined_at"
            )
            .eq(
                "group_id",
                currentGroup.id
            );


    if (error) {

        console.error(
            "LOAD GROUP MEMBERS ERROR:",
            error
        );

        return [];
    }


    const members = [];


    for (
        const membership
        of memberships || []
    ) {

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,name,email"
                )
                .eq(
                    "id",
                    membership.user_id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "LOAD MEMBER PROFILE ERROR:",
                profileError
            );

            continue;
        }


        if (profile) {

            members.push({
                ...profile,
                joined_at:
                    membership.joined_at
            });
        }
    }


    return members;
}


/* =========================================================
   SHOW GROUP MEMBERS
   ========================================================= */

async function showMembersBox() {

    if (!currentGroup) {
        return;
    }


    const box =
        document.getElementById(
            "groupMembersBox"
        );


    box.innerHTML = "";

    box.style.display =
        "block";


    const title =
        document.createElement(
            "div"
        );

    title.className =
        "group-members-title";

    title.textContent =
        "GROUP MEMBERS";


    box.appendChild(title);


    const members =
        await loadGroupMembers();


    if (
        !members ||
        members.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-conversations";

        empty.textContent =
            "No members found.";

        box.appendChild(empty);

        return;
    }


    members.forEach(
        member => {

            const memberRow =
                document.createElement(
                    "div"
                );

            memberRow.className =
                "group-member";


            const memberName =
                document.createElement(
                    "div"
                );

            memberName.className =
                "group-member-name";


            if (
                member.id ===
                currentUser.id
            ) {

                memberName.textContent =
                    (
                        member.name ||
                        member.email
                    ) +
                    " (You)";

            } else {

                memberName.textContent =
                    member.name ||
                    member.email;
            }


            memberRow.appendChild(
                memberName
            );


            /*
             * Only the group creator gets
             * the remove-member button.
             */

            if (
                currentGroup.created_by ===
                currentUser.id &&
                member.id !==
                currentUser.id
            ) {

                const removeButton =
                    document.createElement(
                        "button"
                    );

                removeButton.className =
                    "remove-member-button";

                removeButton.textContent =
                    "Remove";


                removeButton.onclick =
                    function() {

                        removeGroupMember(
                            member
                        );

                    };


                memberRow.appendChild(
                    removeButton
                );
            }


            box.appendChild(
                memberRow
            );

        }
    );
}


/* =========================================================
   REMOVE GROUP MEMBER
   ========================================================= */

async function removeGroupMember(
    member
) {

    if (
        !currentGroup ||
        !currentUser
    ) {

        return;
    }


    if (
        currentGroup.created_by !==
        currentUser.id
    ) {

        alert(
            "Only the group creator can remove members."
        );

        return;
    }


    const confirmed =
        confirm(
            "Remove " +
            (member.name || member.email) +
            " from this group?"
        );


    if (!confirmed) {
        return;
    }


    /*
     * This uses the RPC function you
     * already created in Supabase.
     */

    const {
        error
    } =
        await supabaseClient.rpc(
            "remove_group_member",
            {
                group_id_to_change:
                    currentGroup.id,

                member_id_to_remove:
                    member.id
            }
        );


    if (error) {

        console.error(
            "REMOVE MEMBER ERROR:",
            error
        );

        alert(
            "Could not remove member: " +
            error.message
        );

        return;
    }


    alert(
        member.name +
        " was removed from the group."
    );


    await showMembersBox();
}


/* =========================================================
   DELETE CURRENT GROUP
   ========================================================= */

async function deleteCurrentGroup() {

    if (
        !currentGroup ||
        !currentUser
    ) {

        return;
    }


    if (
        currentGroup.created_by !==
        currentUser.id
    ) {

        alert(
            "Only the group creator can delete the group."
        );

        return;
    }


    const confirmed =
        confirm(
            "Delete the group \"" +
            currentGroup.name +
            "\"?\n\nThis cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    /*
     * This uses the RPC function you
     * already created in Supabase.
     */

    const {
        error
    } =
        await supabaseClient.rpc(
            "delete_group",
            {
                group_id_to_delete:
                    currentGroup.id
            }
        );


    if (error) {

        console.error(
            "DELETE GROUP ERROR:",
            error
        );

        alert(
            "Could not delete group: " +
            error.message
        );

        return;
    }


    currentGroup = null;

    currentConversation = null;

    renderedMessageIds.clear();


    removeGroupControls();


    document.getElementById(
        "conversationName"
    ).textContent =
        "Welcome to Chat Hub";


    document.getElementById(
        "conversationStatus"
    ).textContent =
        "Choose a conversation to start chatting";


    document.getElementById(
        "conversationAvatar"
    ).textContent =
        "✦";


    disableMessageInput();


    document.getElementById(
        "messages"
    ).innerHTML =
        '<div class="welcome-panel">' +
        '<div class="welcome-icon">✦</div>' +
        '<h2>Welcome to Chat Hub</h2>' +
        '<p>Choose a conversation or start a new one.</p>' +
        '</div>';


    await loadGroups();


    alert(
        "Group deleted successfully."
    );
}


/* =========================================================
   DISABLE MESSAGE INPUT
   ========================================================= */

function disableMessageInput() {

    document.getElementById(
        "messageInput"
    ).disabled = true;

    document.getElementById(
        "sendButton"
    ).disabled = true;
}


/* =========================================================
   LOAD GROUP MESSAGES
   ========================================================= */

async function loadGroupMessages() {

    if (
        !currentGroup ||
        !currentUser
    ) {

        return;
    }


    const messagesBox =
        document.getElementById(
            "messages"
        );


    messagesBox.innerHTML = "";

    renderedMessageIds.clear();


    const {
        data: messages,
        error
    } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "group_id",
                currentGroup.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "LOAD GROUP MESSAGES ERROR:",
            error
        );

        messagesBox.innerHTML =
            '<div class="empty-conversations">Unable to load group messages.</div>';

        return;
    }


    if (
        !messages ||
        messages.length === 0
    ) {

        messagesBox.innerHTML =
            '<div class="welcome-panel">' +
            '<div class="welcome-icon">👥</div>' +
            '<h2>Start the group conversation</h2>' +
            '<p>Send the first message to the group.</p>' +
            '</div>';

        return;
    }


    /*
     * Get sender names for group messages.
     */

    const senderIds =
        [
            ...new Set(
                messages.map(
                    message =>
                        message.sender_id
                )
            )
        ];


    const senderMap =
        new Map();


    if (senderIds.length > 0) {

        const {
            data: profiles,
            error: profilesError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,name,email"
                )
                .in(
                    "id",
                    senderIds
                );


        if (!profilesError) {

            (
                profiles || []
            ).forEach(
                profile => {

                    senderMap.set(
                        profile.id,
                        profile
                    );

                }
            );
        }
    }


    messages.forEach(
        message => {

            const sender =
                senderMap.get(
                    message.sender_id
                );


            displayMessage(
                message,
                sender
                    ? sender.name
                    : "User"
            );

        }
    );


    scrollMessagesToBottom();
}


/* =========================================================
   END OF PART 3B
   =========================================================
   
   IMPORTANT:
   Do NOT delete anything above.
   
   PART 3C will be pasted directly underneath.
   ========================================================= */
/* =========================================================
   CHAT HUB — PART 3C
   MESSAGES + EDIT + DELETE + COPY + FORWARD
   REALTIME + SEARCH + SEND
   ========================================================= */


/* =========================================================
   DISPLAY MESSAGE
   ========================================================= */

function displayMessage(message, senderName = null) {

    if (!message || !message.id) return;

    if (renderedMessageIds.has(message.id)) {
        return;
    }

    renderedMessageIds.add(message.id);

    const messagesBox = document.getElementById("messages");

    if (!messagesBox) return;

    const welcome = messagesBox.querySelector(".welcome-panel");

    if (welcome) {
        welcome.remove();
    }

    const row = document.createElement("div");

    row.className =
        "message-row " +
        (message.sender_id === currentUser.id ? "mine" : "theirs");

    row.dataset.messageId = message.id;

    const bubble = document.createElement("div");

    bubble.className = "message-bubble";

    /* Group sender name */

    if (
        currentGroup &&
        senderName &&
        message.sender_id !== currentUser.id
    ) {

        const sender = document.createElement("div");

        sender.className = "message-sender";

        sender.textContent = senderName;

        bubble.appendChild(sender);
    }

    /* Message text */

    const text = document.createElement("div");

    text.className = "message-text";

    text.textContent = message.message || "";

    bubble.appendChild(text);

    /* Bottom area */

    const bottom = document.createElement("div");

    bottom.className = "message-bottom";

    const time = document.createElement("span");

    time.className = "message-time";

    time.textContent = formatTime(message.created_at);

    bottom.appendChild(time);

    /* Menu */

    const menuButton = document.createElement("button");

    menuButton.className = "message-menu-button";

    menuButton.type = "button";

    menuButton.textContent = "⋮";

    menuButton.title = "Message options";

    menuButton.onclick = function (event) {

        event.stopPropagation();

        showMessageMenu(
            message,
            menuButton
        );

    };

    bottom.appendChild(menuButton);

    bubble.appendChild(bottom);

    row.appendChild(bubble);

    messagesBox.appendChild(row);

    scrollMessagesToBottom();
}


/* =========================================================
   MESSAGE MENU
   ========================================================= */

function showMessageMenu(message, button) {

    /* Remove existing menus */

    document
        .querySelectorAll(".message-options-menu")
        .forEach(menu => menu.remove());

    const menu = document.createElement("div");

    menu.className = "message-options-menu";

    const copyButton = document.createElement("button");

    copyButton.textContent = "Copy";

    copyButton.onclick = function () {

        copyMessage(message.message);

        menu.remove();

    };

    menu.appendChild(copyButton);


    const forwardButton = document.createElement("button");

    forwardButton.textContent = "Forward";

    forwardButton.onclick = function () {

        menu.remove();

        forwardMessage(message);

    };

    menu.appendChild(forwardButton);


    /* Own messages can be edited/deleted */

    if (
        currentUser &&
        message.sender_id === currentUser.id
    ) {

        const editButton = document.createElement("button");

        editButton.textContent = "Edit";

        editButton.onclick = function () {

            menu.remove();

            editMessage(message);

        };

        menu.appendChild(editButton);


        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";

        deleteButton.onclick = function () {

            menu.remove();

            deleteMessage(message);

        };

        menu.appendChild(deleteButton);
    }


    document.body.appendChild(menu);


    const rect = button.getBoundingClientRect();

    menu.style.position = "fixed";

    menu.style.top =
        Math.min(
            rect.bottom + 5,
            window.innerHeight - 180
        ) + "px";

    menu.style.left =
        Math.min(
            rect.left,
            window.innerWidth - 160
        ) + "px";


    /* Close menu when clicking elsewhere */

    setTimeout(() => {

        document.addEventListener(
            "click",
            function closeMenu() {

                menu.remove();

                document.removeEventListener(
                    "click",
                    closeMenu
                );

            },
            { once: true }
        );

    }, 0);
}


/* =========================================================
   COPY MESSAGE
   ========================================================= */

async function copyMessage(text) {

    try {

        await navigator.clipboard.writeText(text);

        showNotification(
            "Copied",
            "Message copied to clipboard."
        );

    } catch (error) {

        /* Fallback */

        const textarea =
            document.createElement("textarea");

        textarea.value = text;

        document.body.appendChild(textarea);

        textarea.select();

        document.execCommand("copy");

        textarea.remove();

        showNotification(
            "Copied",
            "Message copied to clipboard."
        );
    }
}


/* =========================================================
   EDIT MESSAGE
   ========================================================= */

async function editMessage(message) {

    const newText = prompt(
        "Edit your message:",
        message.message
    );

    if (newText === null) {
        return;
    }

    const cleanText = newText.trim();

    if (!cleanText) {

        alert("Message cannot be empty.");

        return;
    }


    const { data, error } =
        await supabaseClient
            .from("messages")
            .update({
                message: cleanText
            })
            .eq("id", message.id)
            .eq("sender_id", currentUser.id)
            .select()
            .single();


    if (error) {

        console.error(error);

        alert(
            "Could not edit message.\n\n" +
            error.message
        );

        return;
    }


    replaceDisplayedMessage(data);

    showNotification(
        "Message edited",
        "Your message was updated."
    );
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(message) {

    const confirmed =
        confirm("Delete this message?");

    if (!confirmed) {
        return;
    }


    const { error } =
        await supabaseClient
            .from("messages")
            .delete()
            .eq("id", message.id)
            .eq("sender_id", currentUser.id);


    if (error) {

        console.error(error);

        alert(
            "Could not delete message.\n\n" +
            error.message
        );

        return;
    }


    removeDisplayedMessage(message.id);

    showNotification(
        "Message deleted",
        "The message was deleted."
    );
}


/* =========================================================
   REPLACE MESSAGE ON SCREEN
   ========================================================= */

function replaceDisplayedMessage(message) {

    const row =
        document.querySelector(
            `[data-message-id="${message.id}"]`
        );

    if (!row) return;

    const text =
        row.querySelector(".message-text");

    const time =
        row.querySelector(".message-time");

    if (text) {

        text.textContent =
            message.message || "";
    }

    if (time) {

        time.textContent =
            formatTime(message.created_at);
    }
}


/* =========================================================
   REMOVE MESSAGE FROM SCREEN
   ========================================================= */

function removeDisplayedMessage(messageId) {

    const row =
        document.querySelector(
            `[data-message-id="${messageId}"]`
        );

    if (row) {

        row.remove();
    }

    renderedMessageIds.delete(messageId);
}


/* =========================================================
   FORWARD MESSAGE
   ========================================================= */

async function forwardMessage(message) {

    const target = prompt(
        "Enter the recipient email OR exact group name:"
    );

    if (target === null) {
        return;
    }

    const cleanTarget = target.trim();

    if (!cleanTarget) {
        return;
    }


    /* -----------------------------------------
       Try private user first
       ----------------------------------------- */

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("email", cleanTarget)
            .maybeSingle();


    if (profileError) {

        console.error(profileError);
    }


    if (profile) {

        if (profile.id === currentUser.id) {

            alert(
                "You cannot forward a message to yourself."
            );

            return;
        }


        /* Find existing conversation */

        let { data: conversation } =
            await supabaseClient
                .from("conversations")
                .select("*")
                .or(
                    `and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`
                )
                .maybeSingle();


        /* Create conversation if needed */

        if (!conversation) {

            const { data: newConversationData, error } =
                await supabaseClient
                    .from("conversations")
                    .insert({
                        user1_id: currentUser.id,
                        user2_id: profile.id
                    })
                    .select()
                    .single();


            if (error) {

                alert(
                    "Could not create conversation.\n\n" +
                    error.message
                );

                return;
            }

            conversation =
                newConversationData;
        }


        const { error: messageError } =
            await supabaseClient
                .from("messages")
                .insert({
                    sender_id: currentUser.id,
                    conversation_id: conversation.id,
                    message:
                        "Forwarded: " +
                        (message.message || "")
                });


        if (messageError) {

            alert(
                "Could not forward message.\n\n" +
                messageError.message
            );

            return;
        }


        await loadConversations();

        await openPrivateChat(
            conversation.id,
            profile
        );

        showNotification(
            "Message forwarded",
            "Message sent to " + profile.name
        );

        return;
    }


    /* -----------------------------------------
       Try group name
       ----------------------------------------- */

    const { data: groupRows, error: groupError } =
        await supabaseClient
            .from("groups")
            .select("*")
            .eq("name", cleanTarget);


    if (groupError) {

        console.error(groupError);

        alert(
            "Could not search for the group.\n\n" +
            groupError.message
        );

        return;
    }


    if (!groupRows || groupRows.length === 0) {

        alert(
            "No user with that email or group with that exact name was found."
        );

        return;
    }


    if (groupRows.length > 1) {

        alert(
            "More than one group has that name. " +
            "Please use a unique group name."
        );

        return;
    }


    const group = groupRows[0];


    /* Make sure current user belongs to group */

    const { data: membership } =
        await supabaseClient
            .from("group_members")
            .select("group_id")
            .eq("group_id", group.id)
            .eq("user_id", currentUser.id)
            .maybeSingle();


    if (!membership) {

        alert(
            "You are not a member of this group."
        );

        return;
    }


    const { error: groupMessageError } =
        await supabaseClient
            .from("messages")
            .insert({
                sender_id: currentUser.id,
                group_id: group.id,
                message:
                    "Forwarded: " +
                    (message.message || "")
            });


    if (groupMessageError) {

        alert(
            "Could not forward message.\n\n" +
            groupMessageError.message
        );

        return;
    }


    await loadGroups();

    await openGroupChat(group);

    showNotification(
        "Message forwarded",
        "Message sent to " + group.name
    );
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (!currentUser) {
        return;
    }


    if (
        !currentConversation &&
        !currentGroup
    ) {

        alert(
            "Please choose a conversation or group first."
        );

        return;
    }


    const input =
        document.getElementById("messageInput");

    if (!input) return;


    const text = input.value.trim();

    if (!text) {
        return;
    }


    const messageData = {

        sender_id: currentUser.id,

        message: text
    };


    if (currentConversation) {

        messageData.conversation_id =
            currentConversation.id;
    }


    if (currentGroup) {

        messageData.group_id =
            currentGroup.id;
    }


    const { data, error } =
        await supabaseClient
            .from("messages")
            .insert(messageData)
            .select()
            .single();


    if (error) {

        console.error(error);

        alert(
            "Could not send message.\n\n" +
            error.message
        );

        return;
    }


    displayMessage(
        data,
        currentProfile
            ? currentProfile.name
            : "You"
    );


    input.value = "";

    input.focus();
}


/* =========================================================
   ENTER KEY
   ========================================================= */

function handleEnter(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage();
    }
}


/* =========================================================
   SEARCH CONVERSATIONS + GROUPS
   ========================================================= */

function searchChats() {

    const input =
        document.getElementById("searchChats");

    if (!input) return;

    const search =
        input.value
            .trim()
            .toLowerCase();


    document
        .querySelectorAll(".conversation-item")
        .forEach(item => {

            const searchable =
                (
                    item.dataset.search ||
                    item.textContent ||
                    ""
                ).toLowerCase();


            item.style.display =
                searchable.includes(search)
                    ? ""
                    : "none";
        });
}


/* =========================================================
   FORMAT TIME
   ========================================================= */

function formatTime(date) {

    if (!date) {
        return "";
    }


    const value = new Date(date);


    if (Number.isNaN(value.getTime())) {
        return "";
    }


    return value.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value == null ? "" : String(value);

    return div.innerHTML;
}


/* =========================================================
   REALTIME MESSAGE INFORMATION
   ========================================================= */

async function getIncomingMessageInfo(message) {

    /* Private conversation */

    if (message.conversation_id) {

        const { data: conversation } =
            await supabaseClient
                .from("conversations")
                .select("*")
                .eq("id", message.conversation_id)
                .maybeSingle();


        if (!conversation) {
            return null;
        }


        const isParticipant =
            conversation.user1_id === currentUser.id ||
            conversation.user2_id === currentUser.id;


        if (!isParticipant) {
            return null;
        }


        const otherUserId =
            conversation.user1_id === currentUser.id
                ? conversation.user2_id
                : conversation.user1_id;


        const { data: sender } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", message.sender_id)
                .maybeSingle();


        const { data: otherProfile } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", otherUserId)
                .maybeSingle();


        return {

            type: "private",

            conversation,

            sender,

            otherProfile
        };
    }


    /* Group conversation */

    if (message.group_id) {

        const { data: membership } =
            await supabaseClient
                .from("group_members")
                .select("group_id")
                .eq("group_id", message.group_id)
                .eq("user_id", currentUser.id)
                .maybeSingle();


        if (!membership) {
            return null;
        }


        const { data: group } =
            await supabaseClient
                .from("groups")
                .select("*")
                .eq("id", message.group_id)
                .maybeSingle();


        if (!group) {
            return null;
        }


        const { data: sender } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", message.sender_id)
                .maybeSingle();


        return {

            type: "group",

            group,

            sender
        };
    }


    return null;
}


/* =========================================================
   REALTIME SUBSCRIPTION
   ========================================================= */

function subscribeToRealtime() {

    if (!currentUser) {
        return;
    }


    /* Remove old channel */

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel = null;
    }


    realtimeChannel =
        supabaseClient
            .channel(
                "chat-hub-messages-" +
                currentUser.id
            )


            /* -------------------------------------
               NEW MESSAGE
               ------------------------------------- */

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },

                async payload => {

                    const message =
                        payload.new;


                    if (!message) {
                        return;
                    }


                    /*
                       We already displayed our own
                       sent message.
                    */

                    if (
                        message.sender_id ===
                        currentUser.id
                    ) {

                        return;
                    }


                    const info =
                        await getIncomingMessageInfo(
                            message
                        );


                    if (!info) {
                        return;
                    }


                    /* Private chat */

                    if (
                        info.type === "private"
                    ) {

                        const isCurrentChat =
                            currentConversation &&
                            currentConversation.id ===
                                info.conversation.id;


                        if (isCurrentChat) {

                            displayMessage(
                                message,
                                info.sender
                                    ? info.sender.name
                                    : "User"
                            );

                        } else {

                            showNotification(
                                info.sender
                                    ? "New message from " +
                                      info.sender.name
                                    : "New message",
                                message.message || "",
                                function () {

                                    openPrivateChat(
                                        info.conversation.id,
                                        info.otherProfile
                                    );

                                }
                            );
                        }

                        return;
                    }


                    /* Group chat */

                    if (
                        info.type === "group"
                    ) {

                        const isCurrentGroup =
                            currentGroup &&
                            currentGroup.id ===
                                info.group.id;


                        if (isCurrentGroup) {

                            displayMessage(
                                message,
                                info.sender
                                    ? info.sender.name
                                    : "User"
                            );

                        } else {

                            showNotification(
                                "New message in " +
                                info.group.name,
                                (
                                    info.sender
                                        ? info.sender.name +
                                          ": "
                                        : ""
                                ) +
                                (message.message || ""),
                                function () {

                                    openGroupChat(
                                        info.group
                                    );

                                }
                            );
                        }
                    }
                }
            )


            /* -------------------------------------
               MESSAGE UPDATED
               ------------------------------------- */

            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages"
                },

                payload => {

                    const updated =
                        payload.new;


                    if (!updated) {
                        return;
                    }


                    const row =
                        document.querySelector(
                            `[data-message-id="${updated.id}"]`
                        );


                    if (row) {

                        replaceDisplayedMessage(
                            updated
                        );
                    }
                }
            )


            /* -------------------------------------
               MESSAGE DELETED
               ------------------------------------- */

            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "messages"
                },

                payload => {

                    const oldMessage =
                        payload.old;


                    if (
                        oldMessage &&
                        oldMessage.id
                    ) {

                        removeDisplayedMessage(
                            oldMessage.id
                        );
                    }
                }
            )


            .subscribe(status => {

                console.log(
                    "Realtime status:",
                    status
                );

            });
}


/* =========================================================
   CLOSE REALTIME
   ========================================================= */

function cleanupRealtime() {

    if (!realtimeChannel) {
        return;
    }


    supabaseClient
        .removeChannel(
            realtimeChannel
        );


    realtimeChannel = null;
}


/* =========================================================
   CLICK OUTSIDE MESSAGE MENUS
   ========================================================= */

document.addEventListener(
    "click",
    function () {

        document
            .querySelectorAll(
                ".message-options-menu"
            )
            .forEach(menu => {

                menu.remove();

            });

    }
);


/* =========================================================
   GLOBAL FUNCTIONS
   Makes buttons in index.html work reliably.
   ========================================================= */

window.showLogin = showLogin;
window.showSignup = showSignup;
window.signup = signup;
window.login = login;
window.logout = logout;
window.newConversation = newConversation;
window.newGroup = newGroup;
window.openPrivateChat = openPrivateChat;
window.openGroupChat = openGroupChat;
window.addGroupMember = addGroupMember;
window.loadGroupMembers = loadGroupMembers;
window.removeGroupMember = removeGroupMember;
window.deleteCurrentGroup = deleteCurrentGroup;
window.sendMessage = sendMessage;
window.handleEnter = handleEnter;
window.searchChats = searchChats;


/* =========================================================
   START CHAT HUB
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        checkUser();

    }
);