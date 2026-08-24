const {
  withGuild
} = require('../../utils/guildContext');


module.exports =
async function editMatchCancel(
  interaction
) {

  if (
    !String(
      interaction.customId || ''
    ).startsWith(
      'edit_match_cancel:'
    )
  ) {
    return;
  }


  const editId =
    Number(
      interaction.customId
        .split(':')[1]
    );


  await interaction.deferUpdate();


  return withGuild(
    interaction,

    async ({
      pool,
      guildId
    }) => {

      await pool.query(
        `
        DELETE FROM pending_match_edits

        WHERE id = ?
          AND guild_id = ?
          AND user_id = ?
        `,
        [
          editId,
          guildId,
          interaction.user.id
        ]
      );


      return interaction.editReply({
        content:
          '❌ Edycja meczu została anulowana.',
        embeds: [],
        components: []
      });
    }
  );
};