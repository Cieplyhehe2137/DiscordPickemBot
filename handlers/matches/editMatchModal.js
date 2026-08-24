const isAdmin = require('../../utils/isAdmin');

const {
    withGuild
} = require('../../utils/guildContext');

const {
    logInfo,
    logError
} = require('../../utils/logger');

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');


function parsePolishTimeToUtc(value) {
    const raw = String(value || '').trim();

    if (!raw) {
        return null;
    }

    const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/
    );

    if (!match) {
        return undefined;
    }

    const [
        ,
        yearRaw,
        monthRaw,
        dayRaw,
        hourRaw,
        minuteRaw
    ] = match;

    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        return undefined;
    }

    // Startujemy od "naiwnej" daty
    const naiveUtc = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            0
        )
    );

    // Sprawdzamy jaki offset obowiązuje w Warszawie
    // dla tej konkretnej daty (CET / CEST).
    const formatter = new Intl.DateTimeFormat(
        'en-GB',
        {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }
    );

    const parts = formatter.formatToParts(naiveUtc);

    const get = type =>
        Number(
            parts.find(
                part => part.type === type
            )?.value
        );

    const warsawAsUtc = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second')
    );

    const offsetMs =
        warsawAsUtc -
        naiveUtc.getTime();

    const actualUtc =
        new Date(
            naiveUtc.getTime() -
            offsetMs
        );

    return actualUtc
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
}


module.exports = async function editMatchModal(
    interaction
) {
    try {
        if (!interaction.isModalSubmit()) {
            return;
        }

        if (
            !String(
                interaction.customId || ''
            ).startsWith(
                'edit_match_modal:'
            )
        ) {
            return;
        }


        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: '❌ Brak uprawnień.',
                ephemeral: true
            });
        }


        const matchId = Number(
            String(interaction.customId)
                .split(':')[1]
        );


        if (!matchId) {
            return interaction.reply({
                content:
                    '❌ Nieprawidłowe ID meczu.',
                ephemeral: true
            });
        }


        const teamA =
            interaction.fields
                .getTextInputValue('team_a')
                .trim();


        const teamB =
            interaction.fields
                .getTextInputValue('team_b')
                .trim();


        const bestOf =
            Number(
                interaction.fields
                    .getTextInputValue('best_of')
            );


        const matchNoRaw =
            interaction.fields
                .getTextInputValue('match_no')
                .trim();


        const startRaw =
            interaction.fields
                .getTextInputValue('start_time')
                .trim();


        if (
            !teamA ||
            !teamB
        ) {
            return interaction.reply({
                content:
                    '❌ Nazwy obu drużyn są wymagane.',
                ephemeral: true
            });
        }


        if (
            ![1, 3, 5].includes(bestOf)
        ) {
            return interaction.reply({
                content:
                    '❌ BO musi wynosić 1, 3 albo 5.',
                ephemeral: true
            });
        }


        const matchNo =
            matchNoRaw
                ? Number(matchNoRaw)
                : null;


        if (
            matchNoRaw &&
            (
                !Number.isInteger(matchNo) ||
                matchNo <= 0
            )
        ) {
            return interaction.reply({
                content:
                    '❌ Numer meczu musi być dodatnią liczbą całkowitą.',
                ephemeral: true
            });
        }


        const startTime =
            parsePolishTimeToUtc(startRaw);


        if (
            startRaw &&
            startTime === undefined
        ) {
            return interaction.reply({
                content:
                    '❌ Nieprawidłowa data. Użyj czasu polskiego w formacie: `YYYY-MM-DD HH:mm`.',
                ephemeral: true
            });
        }

        await interaction.deferReply({
            ephemeral: true
        });


        return withGuild(
            interaction,
            async ({ pool, guildId }) => {

                const [[match]] =
                    await pool.query(
                        `
            SELECT
              m.id,
              m.event_id,
              m.team_a,
              m.team_b,
              m.best_of,
              m.match_no,
              m.start_time_utc,

              CASE
                WHEN mr.match_id IS NOT NULL
                THEN 1
                ELSE 0
              END AS has_result

            FROM matches m

            LEFT JOIN match_results mr
              ON mr.guild_id = m.guild_id
             AND mr.event_id = m.event_id
             AND mr.match_id = m.id

            WHERE m.guild_id = ?
              AND m.id = ?

            LIMIT 1
            `,
                        [
                            guildId,
                            matchId
                        ]
                    );


                if (!match) {
                    return interaction.editReply({
                        content:
                            '❌ Nie znaleziono meczu.'
                    });
                }


                const hasResult =
                    Number(match.has_result) === 1;


                // =========================================
                // ROZLICZONY MECZ
                // =========================================

                if (hasResult) {
                    const changedTeams =
                        teamA !== String(match.team_a) ||
                        teamB !== String(match.team_b);

                    const changedBo =
                        bestOf !==
                        Number(match.best_of);


                    if (
                        changedTeams ||
                        changedBo
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ **Ten mecz jest już rozliczony.**\n\n' +
                                'Nie możesz zmienić drużyn ani BO.\n' +
                                'Najpierw użyj **↩️ Cofnij wynik**, a potem edytuj mecz.'
                        });
                    }
                }


                // =========================================
                // USUWAMY STARY PENDING EDIT USERA
                // =========================================

                await pool.query(
                    `
  DELETE FROM pending_match_edits
  WHERE guild_id = ?
    AND user_id = ?
  `,
                    [
                        guildId,
                        interaction.user.id
                    ]
                );


                // =========================================
                // ZAPISUJEMY PENDING EDIT
                // =========================================

                const [insertResult] =
                    await pool.query(
                        `
    INSERT INTO pending_match_edits (
      guild_id,
      user_id,
      match_id,

      team_a,
      team_b,

      best_of,
      match_no,
      start_time_utc
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
                        [
                            guildId,
                            interaction.user.id,
                            matchId,

                            teamA,
                            teamB,

                            bestOf,
                            matchNo,
                            startTime
                        ]
                    );


                const editId =
                    insertResult.insertId;


                logInfo(
                    'matches',
                    'Match edited',
                    {
                        guildId,
                        eventId:
                            match.event_id,

                        matchId,

                        userId:
                            interaction.user.id,

                        before: {
                            teamA:
                                match.team_a,

                            teamB:
                                match.team_b,

                            bestOf:
                                match.best_of,

                            matchNo:
                                match.match_no,

                            startTime:
                                match.start_time_utc
                        },

                        after: {
                            teamA,
                            teamB,
                            bestOf,
                            matchNo,
                            startTime
                        }
                    }
                );


                function display(value) {
                    if (
                        value === null ||
                        value === undefined ||
                        value === ''
                    ) {
                        return '—';
                    }

                    return String(value);
                }


                function changeLine(
                    label,
                    before,
                    after
                ) {
                    const oldValue =
                        display(before);

                    const newValue =
                        display(after);

                    if (oldValue === newValue) {
                        return (
                            `${label}: **${newValue}**`
                        );
                    }

                    return (
                        `${label}:\n` +
                        `~~${oldValue}~~ ➜ **${newValue}**`
                    );
                }


                const previewEmbed =
                    new EmbedBuilder()

                        .setColor(0xFEE75C)

                        .setTitle(
                            '✏️ Podgląd zmian meczu'
                        )

                        .setDescription(
                            `### ${teamA} vs ${teamB}\n\n` +

                            changeLine(
                                '🔵 Drużyna A',
                                match.team_a,
                                teamA
                            ) +

                            '\n\n' +

                            changeLine(
                                '🔴 Drużyna B',
                                match.team_b,
                                teamB
                            ) +

                            '\n\n' +

                            changeLine(
                                '🎮 Format',
                                `BO${match.best_of}`,
                                `BO${bestOf}`
                            ) +

                            '\n\n' +

                            changeLine(
                                '🔢 Numer meczu',
                                match.match_no,
                                matchNo
                            ) +

                            '\n\n' +

                            changeLine(
                                '🕒 Start',
                                match.start_time_utc,
                                startTime
                            ) +

                            '\n\n' +

                            '⚠️ **Zmiany nie zostały jeszcze zapisane.**'
                        );


                const buttons =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId(
                                    `edit_match_confirm:${editId}`
                                )
                                .setLabel(
                                    'Zapisz zmiany'
                                )
                                .setEmoji('✅')
                                .setStyle(
                                    ButtonStyle.Success
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `edit_match_cancel:${editId}`
                                )
                                .setLabel(
                                    'Anuluj'
                                )
                                .setEmoji('❌')
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        );


                return interaction.editReply({
                    content: '',
                    embeds: [previewEmbed],
                    components: [buttons]
                });
            }
        );


    } catch (err) {

        logError(
            'matches',
            'editMatchModal failed',
            {
                message: err.message,
                stack: err.stack
            }
        );


        if (
            interaction.deferred ||
            interaction.replied
        ) {
            return interaction.editReply({
                content:
                    '❌ Nie udało się zapisać zmian meczu.'
            }).catch(() => { });
        }


        return interaction.reply({
            content:
                '❌ Nie udało się zapisać zmian meczu.',
            ephemeral: true
        }).catch(() => { });
    }
};