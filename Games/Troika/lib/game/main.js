ig.module(
	'game.main'
)
.requires(
	'impact.game',
	'impact.font',
  'game.background',
  'game.entities.player',
  'game.entities.orb',
  'game.entities.fireball',
  'game.entities.dino',
  'game.entities.backgroundOrb',
  'game.entities.helperImageLeftArrow',
  'game.entities.helperImageRightArrow',
  'game.entities.helperImageSpacebar',
  'game.entities.helperImageX',
  'game.entities.helperImageZ',
	'game.entities.greenBlock',
	'game.entities.zwei',
	'game.entities.zweiDialog',
  'game.levels.MAP'
)
.defines(function(){

MyGame = ig.Game.extend({

    background : new EntityBackground(),

    clearColor: null,
	gravity: 600,

	font: new ig.Font( 'media/04b03.font.png' ),

    globalVariableForToggleBox : "PURPLE",    // PURPLE OR GREEN
    globalVariableForOrb : null, // FIRE, TOGGLE, OR GRAVITY
    globalVariableForOrbArrayIndex : 0, // FIRE, TOGGLE, OR GRAVITY

    zweiFont: null,


    init: function()
    {

        this.globalVariableForOrb = ["NONE", "FIRE", "TOGGLE", "GRAVITY"];
        this.globalVariableForOrbArrayIndex = 0;


        this.zweiFont = new ig.Font( 'media/ZweiFont.png' );

        ig.input.bind( ig.KEY.LEFT_ARROW, 'left' );
		ig.input.bind( ig.KEY.RIGHT_ARROW, 'right' );
        ig.input.bind( ig.KEY.UP_ARROW, 'up' );


		ig.input.bind( ig.KEY.SPACE, 'jump' );
        ig.input.bind( ig.KEY.Z, 'toggle' );
        ig.input.bind( ig.KEY.X, 'changeOrb' );
        ig.input.bind( ig.KEY.T, 'toggle');

        this.loadLevel( LevelMAP );
	},

	update: function() {

        this.parent();

        //*****************************************
        // screen follows the player, does not go off edge of level
        var player = this.getEntitiesByType( EntityPlayer )[0];
        if (player) {
            x = player.pos.x - (ig.system.width / 2);
            y = player.pos.y - (ig.system.height / 2);

            this._mapWidth = ig.game.backgroundMaps[0].width * ig.game.backgroundMaps[0].tilesize - (ig.system.width);
            this._mapHeight = ig.game.backgroundMaps[0].height * ig.game.backgroundMaps[0].tilesize - (ig.system.height);

            this.screen.x = (x > 0 && x < this._mapWidth) ? x : this.screen.x;
            this.screen.y = (y > 0 && y < this._mapHeight) ? y : this.screen.y;
        }

        ///*******************************************


	},

	draw: function() {
        ig.system.context.clearRect( 0 ,0, ig.system.realWidth, ig.system.realHeight ); //clear screen command


        // Draw all entities and backgroundMaps
        this.parent();


		// Add your own drawing code here
	//	var x = ig.system.width/2,
	//		y = ig.system.height/2;


	//	this.font.draw( 'Troika', 20, ig.system.height-50, ig.Font.ALIGN.LEFT );
	//	this.font.draw( 'Arrows/WSAD to Move', 20, ig.system.height-40, ig.Font.ALIGN.LEFT );
	//	this.font.draw( 'Space to jump, Z to toggle power', 20, ig.system.height-30, ig.Font.ALIGN.LEFT);


        this.zweiFont.draw(  "Zwei...where are you?", 200-this.screen.x, 450-this.screen.y, ig.Font.ALIGN.LEFT);


    }
});


// Start the Game with 60fps, a resolution of width/height, scaled by X
ig.main( '#canvas', MyGame, 60, 600, 500, 1 );

});
