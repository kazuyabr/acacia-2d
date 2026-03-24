export default {
    NAME: 'Acacia',
    DESCRIPTION:
        'Kaetram - это игровой движок с открытым исходным кодом, созданный для помощи тем, кто хочет начать заниматься разработкой игр. За основу была взята демонстрационная игра компании Little Workshop - BrowserQuest. Активы остались прежними, но сам код был полностью вычищен и переделан с нуля.',
    INTRO: {
        COMMON: {
            USERNAME: 'Имя пользователя',
            PASSWORD: 'Пароль',
            EMAIL_ADDRESS: 'Адрес электронной почты',
            CANCEL: 'Отмена',
            PLAY: 'Играть',
            CONTINUE: 'Продолжить',
            CLICK_ANYWHERE_TO_CLOSE: '-- Нажмите в любом месте, чтобы закрыть --'
        },
        LOGIN: {
            REMEMBER_ME: 'Запомнить меня',
            GUEST: 'Играть как гость',
            LOGIN: 'Войти',
            NEW_ACCOUNT: 'Новый аккаунт'
        },
        REGISTER: {
            TITLE: 'Новый персонаж',
            CONFIRM_PASSWORD: 'Подтвердите пароль'
        },
        RESET_PASSWORD: {
            TITLE: 'Сброс пароля',
            SUBMIT: 'Отправить'
        },
        WORLD_SELECT: {
            TITLE: 'Выбор мира'
        },
        CREDITS: {
            TITLE: 'Авторы',
            SPECIAL_THANKS: 'Особая благодарность',
            FOR_PIXEL_ART: 'за пиксельную графику,',
            AND_ASKY_TEAM: 'и команде Asky.',
            MORE_PIXEL_ASSETS_BY: 'Больше пиксельных ресурсов от',
            MUSIC_BY: 'Музыка от'
        },
        ABOUT: {
            TITLE: 'О проекте',
            DESCRIPTION:
                'Kaetram — это браузерное 2D MMORPG-приключение. Вы играете за искателя приключений среди других игроков и исследуете мир Kaetram. Изначально проект начался как форк BrowserQuest, но затем Kaetram превратился в самостоятельную игру. В честь первоначальной идеи ресурсы были сохранены и расширены. Мы — один из немногих open-source игровых проектов, развиваемых сообществом. Нам всегда нужна помощь в программировании, графике и/или написании музыки.',
            SOURCE_CODE_ON: 'Наш исходный код доступен в нашем',
            GITHUB_REPOSITORY: 'репозитории GitHub',
            JOIN_DISCORD: 'Если хотите следить за проектом, присоединяйтесь к нашему',
            DISCORD_SERVER: 'серверу Discord'
        },
        GIT: {
            PLACEHOLDER: 'Структурировать позже'
        },
        DEATH: {
            TITLE: 'Вы погибли...',
            RESPAWN: 'Возродиться'
        },
        LOADER: {
            CONNECTING: 'Подключение'
        },
        FOOTER: {
            DISCORD: 'Discord',
            PATREON: 'Patreon',
            PRIVACY: 'Конфиденциальность'
        }
    }
} as const;
