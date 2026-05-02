-- Blood on the Clocktower – database initialisation
-- Compatible with MySQL 8+
-- Note: database creation and selection is handled by the application.

-- --------------------------------------------------------
-- Tables
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS scripts (
    id      INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(100)    NOT NULL UNIQUE,
    hue     VARCHAR(10)     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS characters (
    id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100)    NOT NULL UNIQUE,
    category            ENUM('townsfolk','outsider','minion','demon','traveler') NOT NULL,
    rules               TEXT            NOT NULL,
    player_count        INT UNSIGNED    NOT NULL DEFAULT 1,
    wakes_first_night   BOOLEAN         NOT NULL DEFAULT FALSE,
    wakes_other_nights  BOOLEAN         NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS script_characters (
    script_id           INT UNSIGNED    NOT NULL,
    character_id        INT UNSIGNED    NOT NULL,
    first_night_order   INT UNSIGNED    NULL,
    other_night_order   INT UNSIGNED    NULL,
    PRIMARY KEY (script_id, character_id),
    CONSTRAINT fk_sc_script
        FOREIGN KEY (script_id)    REFERENCES scripts(id)    ON DELETE CASCADE,
    CONSTRAINT fk_sc_character
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reminder_tokens (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    character_id    INT UNSIGNED    DEFAULT NULL,
    text            VARCHAR(512)    DEFAULT NULL,
    text_size       INT UNSIGNED    DEFAULT 100,
    CONSTRAINT fk_rt_character
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS games (
    id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    script_id           INT UNSIGNED    NOT NULL,
    created             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_played         DATETIME        DEFAULT NULL,
    notes               VARCHAR(1024)   NOT NULL DEFAULT '',   
    CONSTRAINT fk_g_script
        FOREIGN KEY (script_id)     REFERENCES scripts(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_characters(
    game_id       INT UNSIGNED,
    character_id        INT UNSIGNED,
    CONSTRAINT fk_gc_game
        FOREIGN KEY (game_id) REFERENCES games(id)  ON DELETE CASCADE,
    CONSTRAINT fk_gc_character
        FOREIGN KEY (character_id)  REFERENCES characters(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_bluffs (
    game_id             INT UNSIGNED    NOT NULL,
    character_id        INT UNSIGNED    NOT NULL,
    PRIMARY KEY (game_id, character_id),
    CONSTRAINT fk_gb_game
        FOREIGN KEY (game_id)       REFERENCES games(id)    ON DELETE CASCADE,
    CONSTRAINT fk_gb_character
        FOREIGN KEY (character_id)  REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS clocks (
    id INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clock_timer_options (
    id                          INT UNSIGNED                AUTO_INCREMENT PRIMARY KEY,
    clock_id                    INT UNSIGNED NOT NULL,
    duration_seconds            INT UNSIGNED NOT NULL,
    bell_ring_when_remaining    INT UNSIGNED                DEFAULT NULL,
    label                       VARCHAR(100)                DEFAULT NULL,
    CONSTRAINT fk_cto_clock
        FOREIGN KEY (clock_id) REFERENCES clocks(id) ON DELETE CASCADE
);




-- --------------------------------------------------------
-- Scripts
-- --------------------------------------------------------

INSERT INTO scripts (name, hue) VALUES
    ('Trouble Brewing',  '#FF5733'),
    ('Bad Moon Rising',  '#FFC300'),
    ('Sects and Violets','#9B59B6'),
    ('Good Time a Brewin','#dcaf81');

-- --------------------------------------------------------
-- Characters
-- --------------------------------------------------------

INSERT INTO characters (name, category, rules, player_count, wakes_first_night, wakes_other_nights) VALUES
-- Trouble Brewing – Townsfolk
('Washerwoman',      'townsfolk', 'You start knowing that 1 of 2 players is a particular Townsfolk.', 1, TRUE, FALSE),
('Librarian',        'townsfolk', 'You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)', 1, TRUE, FALSE),
('Investigator',     'townsfolk', 'You start knowing that 1 of 2 players is a particular Minion.', 1, TRUE, FALSE),
('Chef',             'townsfolk', 'You start knowing how many pairs of evil players there are.', 1, TRUE, FALSE),
('Empath',           'townsfolk', 'Each night, you learn how many of your 2 alive neighbours are evil.', 1, TRUE, TRUE),
('Fortune Teller',   'townsfolk', 'Each night, choose 2 players: you learn if either is a Demon. There is a lying good player.', 1, FALSE, TRUE),
('Undertaker',       'townsfolk', 'Each night*, you learn which character died by execution today.', 1, FALSE, TRUE),
('Monk',             'townsfolk', 'Each night*, choose a player (not yourself): they are safe from the Demon tonight.', 1, FALSE, TRUE),
('Ravenkeeper',      'townsfolk', 'If you die at night, you are woken to choose a player: you learn their character.', 1, FALSE, TRUE),
('Virgin',           'townsfolk', 'The 1st time you are nominated, if the nominator is a Townsfolk, they are immediately executed.', 1, FALSE, FALSE),
('Slayer',           'townsfolk', 'Once per game, during the day, publicly choose a player: if they are the Demon, they die.', 1, FALSE, FALSE),
('Soldier',          'townsfolk', 'You are safe from the Demon.', 1, FALSE, FALSE),
('Mayor',            'townsfolk', 'If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.', 1, FALSE, FALSE),
-- Trouble Brewing – Outsiders
('Butler',           'outsider',  'Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.', 1, TRUE, TRUE),
('Drunk',            'outsider',  'You do not know you are the Drunk. You think you are a Townsfolk character, but your ability malfunctions.', 0, FALSE, FALSE),
('Recluse',          'outsider',  'You might register as evil & as a Minion or Demon, even if dead.', 1, FALSE, FALSE),
('Saint',            'outsider',  'If you die by execution, your team loses.', 1, FALSE, FALSE),
-- Trouble Brewing – Minions
('Poisoner',         'minion',    'Each night, choose a player: they are poisoned tonight and tomorrow day.', 1, TRUE, TRUE),
('Spy',              'minion',    'Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.', 1, TRUE, TRUE),
('Scarlet Woman',    'minion',    'If there are 5 or more players alive & the Demon dies, you become the Demon. (Travellers don''t count.)', 1, TRUE, TRUE),
('Baron',            'minion',    'There are extra Outsiders in play. [+2 Outsiders]', 1, FALSE, FALSE),
-- Trouble Brewing – Demon
('Imp',              'demon',     'Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.', 1, FALSE, TRUE),
-- Bad Moon Rising – Townsfolk
('Grandmother',      'townsfolk', 'You start knowing a Townsfolk player & their character. If the Demon kills them, you die too.', 1, TRUE, FALSE),
('Sailor',           'townsfolk', 'Each night, choose a living player: either you or they are drunk until dusk. You can''t die.', 1, TRUE, FALSE),
('Chambermaid',      'townsfolk', 'Each night, choose 2 alive players (not yourself): you learn how many woke tonight due to their ability.', 1, TRUE, FALSE),
('Exorcist',         'townsfolk', 'Each night*, choose a player (different from last night): the Demon, if chosen, does not act tonight.', 1, TRUE, FALSE),
('Innkeeper',        'townsfolk', 'Each night*, choose 2 players: they are safe from the Demon tonight, but 1 is drunk until dusk.', 1, TRUE, FALSE),
('Gambler',          'townsfolk', 'Each night*, choose a player & guess their character: if wrong, you die.', 1, TRUE, FALSE),
('Gossip',           'townsfolk', 'Each day, you may make a public statement. Tonight, if it was true, a player dies.', 1, TRUE, FALSE),
('Courtier',         'townsfolk', 'Once per game, at night, choose a character: they are drunk for 3 nights & 3 days.', 1, TRUE, FALSE),
('Professor',        'townsfolk', 'Once per game, at night*, choose a dead player: if they are a Townsfolk, they are resurrected.', 1, TRUE, FALSE),
('Minstrel',         'townsfolk', 'When a Minion dies by execution, all other players (except Travellers) are drunk until dusk tomorrow.', 1, TRUE, FALSE),
('Tea Lady',         'townsfolk', 'If both your living neighbours are good, they can''t die.', 1, TRUE, FALSE),
('Pacifist',         'townsfolk', 'Occasionally, executed good players don''t die.', 1, TRUE, FALSE),
('Fool',             'townsfolk', 'The first time you die, you don''t.', 1, TRUE, FALSE),
-- Bad Moon Rising – Outsiders
('Tinker',           'outsider',  'You might die at any time.', 1, TRUE, FALSE),
('Moonchild',        'outsider',  'When you learn that you are dead, publicly choose a living player: if good, they die.', 1, TRUE, FALSE),
('Goon',             'outsider',  'Each night, the first player to choose you with their ability is drunk until dusk. You become their alignment.', 1, TRUE, FALSE),
('Lunatic',          'outsider',  'You think you are a Demon, but you are not. The Demon knows who you are. You attack players each night.', 1, TRUE, FALSE),
-- Bad Moon Rising – Minions
('Godfather',        'minion',    'You start knowing which Outsiders are in play. If 1 died today, choose a player tonight: they die. [-1 or +1 Outsider]', 1, TRUE, FALSE),
('Devil''s Advocate','minion',    'Each night, choose a living player (different from last night): if executed tomorrow, they don''t die.', 1, TRUE, FALSE),
('Assassin',         'minion',    'Once per game, at night*, choose a player: they die, even if for some reason they could not.', 1, TRUE, FALSE),
('Mastermind',       'minion',    'If the Demon dies by execution (ending the game), your team wins instead!', 1, TRUE, FALSE),
-- Bad Moon Rising – Demons
('Zombuul',          'demon',     'Each night*, if no-one died today, choose a player: they die. You register as dead when you are not.', 1, TRUE, FALSE),
('Pukka',            'demon',     'Each night, choose a player: they are poisoned. The previously poisoned player dies then becomes unpoisoned.', 1, TRUE, FALSE),
('Shabaloth',        'demon',     'Each night*, choose 2 players: they die. A player that died last night might be regurgitated.', 1, TRUE, FALSE),
('Po',               'demon',     'Each night*, you may choose a player: they die. If your last choice was no-one, choose 3 players tonight.', 1, TRUE, FALSE),
-- Sects and Violets – Townsfolk
('Clockmaker',       'townsfolk', 'You start knowing how many steps from the Demon to its nearest Minion.', 1, TRUE, FALSE),
('Dreamer',          'townsfolk', 'Each night, choose a player (not yourself or Travellers): you learn 1 true & 1 false character for them.', 1, TRUE, FALSE),
('Snake Charmer',    'townsfolk', 'Each night, choose an alive player: a chosen Demon swaps characters & alignments with you & is now good.', 1, TRUE, FALSE),
('Mathematician',    'townsfolk', 'Each night, you learn how many players'' abilities have malfunctioned due to another character''s ability.', 1, TRUE, FALSE),
('Flowergirl',       'townsfolk', 'Each night*, you learn if a Demon voted today.', 1, TRUE, FALSE),
('Town Crier',       'townsfolk', 'Each night*, you learn if a Minion nominated today.', 1, TRUE, FALSE),
('Oracle',           'townsfolk', 'Each night*, you learn how many dead players are evil.', 1, TRUE, FALSE),
('Savant',           'townsfolk', 'Each day, you may visit the Storyteller to learn 2 things in private: 1 is true & 1 is false.', 1, TRUE, FALSE),
('Seamstress',       'townsfolk', 'Once per game, at night, choose 2 players (not yourself): you learn if they are the same alignment.', 1, TRUE, FALSE),
('Philosopher',      'townsfolk', 'Once per game, at night, choose a good character: gain that ability. If this character is in play, they are drunk.', 1, TRUE, FALSE),
('Artist',           'townsfolk', 'Once per game, during the day, privately ask the Storyteller any yes/no question.', 1, TRUE, FALSE),
('Juggler',          'townsfolk', 'On your 1st day, publicly guess up to 5 players'' characters. That night, you learn how many you got correct.', 1, TRUE, FALSE),
('Sage',             'townsfolk', 'If the Demon kills you, you learn that it is 1 of 2 players.', 1, TRUE, FALSE),
-- Sects and Violets – Outsiders
('Mutant',           'outsider',  'If you are mad that you are an Outsider, you might be executed.', 1, TRUE, FALSE),
('Sweetheart',       'outsider',  'When you die, 1 player is drunk from now on.', 1, TRUE, FALSE),
('Barber',           'outsider',  'If you died today, the Demon may choose 2 players to swap characters tonight.', 1, TRUE, FALSE),
('Klutz',            'outsider',  'When you learn that you died, publicly choose 1 of your living neighbours: if good, they die.', 1, TRUE, FALSE),
-- Sects and Violets – Minions
('Evil Twin',        'minion',    'You & an opposing player know each other. If the good player is executed, evil wins. Good can''t win if you both live.', 1, TRUE, FALSE),
('Witch',            'minion',    'Each night, choose a player: if they nominate tomorrow, they die. If just 3 players live, you lose your ability.', 1, TRUE, TRUE),
('Cerenovus',        'minion',    'Each night, choose a player & a good character: they are madly claiming to be that character until dusk.', 1, TRUE, TRUE),
('Pit-Hag',          'minion',    'Each night*, choose a player & a character: they become that character. If this creates a new Demon, Minions don''t wake with it.', 1, TRUE, FALSE),
-- Sects and Violets – Demons
('Fang Gu',          'demon',     'Each night*, choose a player: they die. The first Outsider this kills becomes an evil Fang Gu & you die instead. [+1 Outsider]', 1, TRUE, FALSE),
('Vigormortis',      'demon',     'Each night*, choose a player: they die. Minions you kill keep their ability & poison 1 of their neighbours. [-1 Outsider]', 1, TRUE, FALSE),
('No Dashii',        'demon',     'Each night*, choose a player: they die. Your 2 Townsfolk neighbours are poisoned.', 1, FALSE, TRUE),
('Vortox',           'demon',     'Each night*, choose a player: they die. Townsfolk abilities yield false info. Each day, if no execution, evil wins.', 1, FALSE, TRUE),
-- Good Time a Brewin - Outsiders
('Ogre',             'outsider',  'On your 1st night, choose a player (not yourself): you become their alignment (you don''t know which) even if drunk or poisoned.', 1, TRUE, FALSE),
-- Good Time a Brewin - Minions
('Boffin',           'minion',    'The Demon (even if drunk or poisoned) has a not-in-play good character''s ability. You both know which.', 1, TRUE, FALSE),
('Marionette',       'minion',    'You think you are a good character, but you are not. The Demon knows who you are. [You neighbor the Demon]', 0, TRUE, FALSE);
-- --------------------------------------------------------
-- Script ↔ character links
-- --------------------------------------------------------

INSERT INTO script_characters (script_id, character_id)
SELECT s.id, c.id
FROM scripts s
JOIN characters c ON c.name IN (
    'Washerwoman','Librarian','Investigator','Chef','Empath','Fortune Teller',
    'Undertaker','Monk','Ravenkeeper','Virgin','Slayer','Soldier','Mayor',
    'Butler','Drunk','Recluse','Saint',
    'Poisoner','Spy','Scarlet Woman','Baron',
    'Imp'
)
WHERE s.name = 'Trouble Brewing';


INSERT INTO script_characters (script_id, character_id)
SELECT s.id, c.id
FROM scripts s
JOIN characters c ON c.name IN (
    'Washerwoman','Librarian','Investigator','Chef','Empath','Fortune Teller',
    'Undertaker','Monk','Ravenkeeper','Virgin','Slayer','Soldier','Mayor',
    'Ogre','Drunk','Recluse','Saint',
    'Poisoner','Spy','Scarlet Woman','Baron','Boffin','Marionette',
    'Imp'
)
WHERE s.name = 'Good Time a Brewin';

INSERT INTO script_characters (script_id, character_id)
SELECT s.id, c.id
FROM scripts s
JOIN characters c ON c.name IN (
    'Grandmother','Sailor','Chambermaid','Exorcist','Innkeeper','Gambler',
    'Gossip','Courtier','Professor','Minstrel','Tea Lady','Pacifist','Fool',
    'Tinker','Moonchild','Goon','Lunatic',
    'Godfather','Devil''s Advocate','Assassin','Mastermind',
    'Zombuul','Pukka','Shabaloth','Po'
)
WHERE s.name = 'Bad Moon Rising';

INSERT INTO script_characters (script_id, character_id)
SELECT s.id, c.id
FROM scripts s
JOIN characters c ON c.name IN (
    'Clockmaker','Dreamer','Snake Charmer','Mathematician','Flowergirl',
    'Town Crier','Oracle','Savant','Seamstress','Philosopher','Artist','Juggler','Sage',
    'Mutant','Sweetheart','Barber','Klutz',
    'Evil Twin','Witch','Cerenovus','Pit-Hag',
    'Fang Gu','Vigormortis','No Dashii','Vortox'
)
WHERE s.name = 'Sects and Violets';



-- --------------------------------------------------------
-- Night orders  (NULL = character does not wake that night)
-- --------------------------------------------------------

-- Trouble Brewing
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 1,  sc.other_night_order = 1  WHERE s.name = 'Trouble Brewing' AND c.name = 'Poisoner';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 2                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Washerwoman';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 3                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Librarian';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 4                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Investigator';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 5                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Chef';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 6,  sc.other_night_order = 6  WHERE s.name = 'Trouble Brewing' AND c.name = 'Empath';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 7,  sc.other_night_order = 7  WHERE s.name = 'Trouble Brewing' AND c.name = 'Fortune Teller';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 8,  sc.other_night_order = 8  WHERE s.name = 'Trouble Brewing' AND c.name = 'Butler';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 9,  sc.other_night_order = 10 WHERE s.name = 'Trouble Brewing' AND c.name = 'Spy';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 2                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Monk';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 3                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Scarlet Woman';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 4                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Imp';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 5                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Ravenkeeper';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 9                             WHERE s.name = 'Trouble Brewing' AND c.name = 'Undertaker';


-- Good Time a Brewing
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 1                             WHERE s.name = 'Good Time a Brewin' AND c.name = 'Boffin';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 2                             WHERE s.name = 'Good Time a Brewin' AND c.name = 'Marionette';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 3,  sc.other_night_order = 1  WHERE s.name = 'Good Time a Brewin' AND c.name = 'Poisoner';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 4                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Washerwoman';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 5                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Librarian';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 6                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Investigator';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 7                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Chef';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 8,  sc.other_night_order = 6  WHERE s.name = 'Good Time a Brewin'AND c.name = 'Empath';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 9,  sc.other_night_order = 7  WHERE s.name = 'Good Time a Brewin'AND c.name = 'Fortune Teller';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 10,  sc.other_night_order = 9 WHERE s.name = 'Good Time a Brewin'AND c.name = 'Spy';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 11                            WHERE s.name = 'Good Time a Brewin'AND c.name = 'Ogre';

UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 2                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Monk';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 3                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Scarlet Woman';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 4                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Imp';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 5                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Ravenkeeper';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 8                             WHERE s.name = 'Good Time a Brewin'AND c.name = 'Undertaker';



-- Bad Moon Rising
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 1,  sc.other_night_order = 7  WHERE s.name = 'Bad Moon Rising' AND c.name = 'Godfather';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 2,  sc.other_night_order = 1  WHERE s.name = 'Bad Moon Rising' AND c.name = 'Sailor';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 3,  sc.other_night_order = 16 WHERE s.name = 'Bad Moon Rising' AND c.name = 'Grandmother';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 4,  sc.other_night_order = 17 WHERE s.name = 'Bad Moon Rising' AND c.name = 'Chambermaid';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 5,  sc.other_night_order = 5  WHERE s.name = 'Bad Moon Rising' AND c.name = 'Courtier';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 6,  sc.other_night_order = 9  WHERE s.name = 'Bad Moon Rising' AND c.name = 'Lunatic';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 7,  sc.other_night_order = 6  WHERE s.name = 'Bad Moon Rising' AND c.name = 'Devil''s Advocate';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 8,  sc.other_night_order = 11 WHERE s.name = 'Bad Moon Rising' AND c.name = 'Pukka';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 2                             WHERE s.name = 'Bad Moon Rising' AND c.name = 'Exorcist';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 3                             WHERE s.name = 'Bad Moon Rising' AND c.name = 'Innkeeper';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 4                             WHERE s.name = 'Bad Moon Rising' AND c.name = 'Gambler';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 8                             WHERE s.name = 'Bad Moon Rising' AND c.name = 'Assassin';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 10                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Zombuul';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 12                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Shabaloth';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 13                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Po';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 14                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Tinker';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 15                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Moonchild';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 18                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Professor';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 19                            WHERE s.name = 'Bad Moon Rising' AND c.name = 'Gossip';

-- Sects and Violets
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 1,  sc.other_night_order = 1  WHERE s.name = 'Sects and Violets' AND c.name = 'Philosopher';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 2                             WHERE s.name = 'Sects and Violets' AND c.name = 'Clockmaker';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 3,  sc.other_night_order = 13 WHERE s.name = 'Sects and Violets' AND c.name = 'Dreamer';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 4,  sc.other_night_order = 2  WHERE s.name = 'Sects and Violets' AND c.name = 'Snake Charmer';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 5,  sc.other_night_order = 14 WHERE s.name = 'Sects and Violets' AND c.name = 'Mathematician';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 6,  sc.other_night_order = 15 WHERE s.name = 'Sects and Violets' AND c.name = 'Seamstress';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 7                             WHERE s.name = 'Sects and Violets' AND c.name = 'Evil Twin';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 8,  sc.other_night_order = 8  WHERE s.name = 'Sects and Violets' AND c.name = 'Witch';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.first_night_order = 9,  sc.other_night_order = 9  WHERE s.name = 'Sects and Violets' AND c.name = 'Cerenovus';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 3                             WHERE s.name = 'Sects and Violets' AND c.name = 'Pit-Hag';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 4                             WHERE s.name = 'Sects and Violets' AND c.name = 'Fang Gu';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 5                             WHERE s.name = 'Sects and Violets' AND c.name = 'Vigormortis';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 6                             WHERE s.name = 'Sects and Violets' AND c.name = 'No Dashii';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 7                             WHERE s.name = 'Sects and Violets' AND c.name = 'Vortox';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 10                            WHERE s.name = 'Sects and Violets' AND c.name = 'Flowergirl';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 11                            WHERE s.name = 'Sects and Violets' AND c.name = 'Town Crier';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 12                            WHERE s.name = 'Sects and Violets' AND c.name = 'Oracle';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 16                            WHERE s.name = 'Sects and Violets' AND c.name = 'Barber';
UPDATE script_characters sc JOIN scripts s ON s.id = sc.script_id JOIN characters c ON c.id = sc.character_id
    SET sc.other_night_order = 17                            WHERE s.name = 'Sects and Violets' AND c.name = 'Sage';


