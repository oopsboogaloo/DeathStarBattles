import java.applet.Applet;
import java.awt.*;
import java.text.NumberFormat;
import java.lang.Math;
import java.util.Random;
import java.lang.*;
import java.awt.event.*;
public class gravityapplet extends Applet 
               implements MouseListener,ActionListener,AdjustmentListener,Runnable,KeyListener, FocusListener{

    //the next line declares the double buffering image
    Image buffer;
    Image buffer2;
    //the next line declares the double buffering Graphics
    Graphics bufferg;
    Graphics buffer2g;
    int painted=0;

    // Font and fontmetric information
    //   Font bigfont=new Font("Courier",Font.BOLD,24);
    //   FontMetrics bigfm = buffer2g.getFontMetrics(bigfont);
    FontMetrics bigfm;
    FontMetrics smallfm;
    //Font smallfont=new Font("Serif",Font.BOLD,14);
    Font smallfont;
    Font bigfont;
    // constants
    static int maxnplanets=16;
    static int bulletlife=8000;
    static int maxnplayers=12;
    //int maxnplayersperteam=1;
    //static int maxnplayers=maxnplayers*maxnplayersperteam;
    static int maxplanetsize=10;
    static int nscenairios=21;
    static int nsize=6;
    static int nAI=5;
    static int printevery=10;
    static int showevery=10;
    boolean allAI=false;
    boolean pause=false;
    boolean onestep=false;

    int bloodlustaward=-1;
    int oppressionaward=-1;
    int bullyaward=-1;
    int vengenceaward=-1;

    int awards=-1;                    //show awards for player awards
    int awardsevery=5;                //show awards every awardsevery games
    int waitingfor=15;
    int checkactive=0;
    int starfield=1;
    int scenairio=1;
    int menuscenairio=nscenairios+1;
    int nplanets=maxnplanets+1;
    int nplayersperteam=1;
    int nteams=2;
    int nplayers=nteams*nplayersperteam;
    int menunplanets=maxnplanets+1;
    int menunplayersperteam=1;
    int menunplayers=2;
    int menunhumanplayers=1;
    int menuAI=3;
    int menuoption=1;
    int menutornamentmode=0;
    int tornamentmode=0;
    int game=0;
    int menusize=4;
    int nhumanplayers=1;
    int noptions=2;
    int AI=3;
    int station;
    int counting=0;
    int size=4;
    int keydown=0;
    int timesdrawn=0;
    int currentplayer=0;
    long drawtime=0;
    long thetime=0;
    long delaytime=0;
    boolean focused=false;
    boolean Qdown=false;
    boolean Wdown=false;
    //int nstations=nplayersperteam*nplayers;
    int winner;
    int planetsize=1;
    int actingIradius=30;
    Scrollbar horiz1=new Scrollbar(Scrollbar.HORIZONTAL,1,90,1,450);
    Scrollbar horiz2=new Scrollbar(Scrollbar.HORIZONTAL,1,199,1,1000);
    //TextField num1=new TextField(5);
    //TextField num2=new TextField(5);
    Panel northpanel=new Panel();
    Panel southpanel=new Panel();
    GridLayout toplayout=new GridLayout(1,6);
    GridLayout bottomlayout=new GridLayout(1,3);
        
    //North panel buttons
    Button restartbutton=new Button("Start Game");
    Button playerbutton=new Button(nplayers+" players");
    Button stationbutton=new Button(nplayersperteam+" stations/player");
         //Button sizebutton=new Button("size: medium");
    Button AIbutton=new Button("Cpu: cleverbot");
    Button humanplayersbutton=new Button("1 human 1 cpu");
    Button optionsbutton=new Button("More Options...");
         //Button planetbutton=new Button(nplanets+" planets");
         //Button scenairiobutton=new Button("Planetary");

    //South panel buttons
    Button hyperspacebutton=new Button("Hyperspace");
    Button firebutton=new Button("End Turn");

    Thread main;
    private boolean running;
    int firstgo=1;
    double conv=1.0;

    double percentfree;

    //    int playerstatus[]= new int[maxnplayers+1];

    Color planetcolour[]=new Color[maxnplanets+1];
    double planetx[]=new double[maxnplanets+1];
    double planety[]=new double[maxnplanets+1];
    double planetradius[]=new double[maxnplanets+1];
    int planetIradius[]=new int[maxnplanets+1];
    int planetshading[]=new int[maxnplanets+1];
    double planetM[]=new double[maxnplanets+1];
    double planetdensity[]=new double[maxnplanets+1];
    int planetimpact[]=new int[maxnplanets+1];
    double planethalo[]=new double[maxnplanets+1];

    double totalmass;

    Color stationcolour[]=new Color[maxnplayers+1];
    Color teamcolour[]=new Color[maxnplayers+1];
    double stationx[]=new double[maxnplayers+1];
    double stationy[]=new double[maxnplayers+1];
    double oldstationx[]=new double[maxnplayers+1];
    double oldstationy[]=new double[maxnplayers+1];
    double stationradius[]=new double[maxnplayers+1];
    //int AIangle[]=new int[maxAI+1];
    //int AIpower[]=new int[maxAI+1];
    //int AIclosest[][]=new int[][maxAI+1];

    int stationcount[]=new int[maxnplayers+1];
    int stationIradius[]=new int[maxnplayers+1];
    int stationboxradius[]=new int[maxnplayers+1];
    int stationarrowminradius[]=new int[maxnplayers+1];

    int leaderboard[]=new int[maxnplayers+1];
    int team;
   
      int topteam=-1;         //top of score board
      int winningteam=-1;     //most stations in play
      int losingteam=-1;      //least stations in play
      int bottomteam=-1;      //bottom of score board

    int bigsize=64;       //for the big font
    int smallsize=38;    //for ths small font


    static int maxteleports=100;                               //maximum number of allowed teleports
    int numberofteleports[]=new int[maxnplayers+1];            //number of teleports
    int teleports[][]=new int[maxnplayers+1][maxteleports+1];  //int location of teleports in pathx and pathy arrays

    double longshotthreashhold=0.6;
    double closeshotthreashhold=0.2;
    int stationtotalpower[]=new int[maxnplayers+1];
    int stationvengencekills[]=new int[maxnplayers+1];
    int stationstrategykills[]=new int[maxnplayers+1];
    int stationtacticskills[]=new int[maxnplayers+1];
    int stationbullykills[]=new int[maxnplayers+1];
    int stationopressionkills[]=new int[maxnplayers+1];
    int stationlongshotkills[]=new int[maxnplayers+1];
    int stationcloseshotkills[]=new int[maxnplayers+1];
    int stationturns[]=new int[maxnplayers+1];
    int stationowngoals[]=new int[maxnplayers+1];
    int stationsuicide[]=new int[maxnplayers+1];
    int stationkills[]=new int[maxnplayers+1];
    int stationshots[]=new int[maxnplayers+1];
    int stationkilledby[]=new int[maxnplayers+1];
    int stationsurvive[]=new int[maxnplayers+1];
    int teamturns[]=new int[maxnplayers+1];
    int teamwins[]=new int[maxnplayers+1];
    int teamleader[]=new int[maxnplayers+1];
    int teamowngoals[]=new int[maxnplayers+1];
    int teamsuicide[]=new int[maxnplayers+1];
    int teamkills[]=new int[maxnplayers+1];
    int teamshots[]=new int[maxnplayers+1];
    int teamsurvive[]=new int[maxnplayers+1];
    int teamscore[]=new int[maxnplayers+1];
    int stationstatus[]=new int[maxnplayers+1];
    int stationtarget[]=new int[maxnplayers+1];
    double stationexplosion[]=new double[maxnplayers+1];
    //int stationcount[]=new int[maxnplayers+1];
    int stationteam[]=new int[maxnplayers+1];
    int stationnumber[]=new int[maxnplayers+1];
    int stationhyperspace[]=new int[maxnplayers+1];
    int Angle[]=new int[maxnplayers+1];
    int Power[]=new int[maxnplayers+1];
    int LastAngle[]=new int[maxnplayers+1];
    int LastPower[]=new int[maxnplayers+1];
    int lastdisplayed[]=new int[maxnplayers+1];
    int bestAIAngle[][]=new int[maxnplayers+1][maxnplayers+1];
    int bestAIPower[][]=new int[maxnplayers+1][maxnplayers+1];
    int player;
    //    int station;
    int playerAI[]=new int[maxnplayers+1];

    Color colour[]=new Color[maxnplayers+1];
    double x[]=new double[maxnplayers+1];
    double y[]=new double[maxnplayers+1];
    double oldx[]=new double[maxnplayers+1];
    double oldy[]=new double[maxnplayers+1];
    double voldx[]=new double[maxnplayers+1];
    double voldy[]=new double[maxnplayers+1];
    double vvoldx[]=new double[maxnplayers+1];
    double vvoldy[]=new double[maxnplayers+1];
    double vvvoldx[]=new double[maxnplayers+1];
    double vvvoldy[]=new double[maxnplayers+1];
    double radius[]=new double[maxnplayers+1];
    int Iradius[]=new int[maxnplayers+1];
    double explosion[]=new double[maxnplayers+1];
    double xvelocity[]=new double[maxnplayers+1];
    double yvelocity[]=new double[maxnplayers+1];
    int status[] =new int[maxnplayers+1];
    int mode;
    int turn=0;
    int godraw=1;
    int startnew;
    int listenmode;
    int wipe=1;
    int hyperspacing=0;
    int nstars=2000;
    int nangles=1000;
    int seed=100;
    int xset[]=new int[nangles];
    int yset[]=new int[nangles];
    int starx[]=new int[nstars+1];
    int stary[]=new int[nstars+1];
    int starr[]=new int[nstars+1];

    int pathx[][]=new int[maxnplayers+1][bulletlife+500];
    int pathy[][]=new int[maxnplayers+1][bulletlife+500];
    int spathx[]=new int[bulletlife+500];
    int spathy[]=new int[bulletlife+500];
    int spathl=0;
    int pathl[]=new int [maxnplayers+1];

    int pathl2=0;
    double highestA;
    double pathclosest;
    double pathclosest2;

    Color starcolour[]=new Color[nstars];
    NumberFormat nf = NumberFormat.getInstance();

    double xacceleration;
    double yacceleration;
    double drag;
    double timestep;
    double G;
    double Ttheta;
    double TdeltaX;
    double TdeltaY;
    double TAccel;

    int step;
    int pathstep;

    double initialdistance=1.0;
    double maxpower=0.8;
    double minpower=0.2;
    double minarrow=4.;
    double powerarrowsize=8.;
    double poo=0;
    double poo2=0;
    String test;
    int testint=0;
 
    int topgap=0;    //gap at top of screen taken up by menu
    int bottomgap=0; //gap at bottom of screen taken up by menu
    double topgapoverconv=0.0;     //gap at top of screen taken up by menu devided by conv
    double bottomgapoverconv=0.0;  //gap at bottom of screen taken up by menu devided by conv
    int screenwidth;
    int screenheight;
    double width;
    double height;
    double left;
    double top;
    double right;
    double bottom;


    //the init() method occurs when the Applet is initialized(loaded)
    public void init(){
      int choice;

        screenwidth=getSize().width;
        screenheight=getSize().height;
        conv=screenwidth/(double)700;
        width=(float)screenwidth/conv;
        height=(float)screenheight/conv;
        left=-width;
        top=-width;
        right=2.0*width;
        bottom=1.0*height+1.0*width;

        setSize(screenwidth,screenheight);

        
        setLayout(new BorderLayout());
        add("North",northpanel);
        add("South",southpanel);
        //northpanel.setLayout(new GridLayout(1,6));
        if(screenwidth<600) toplayout=new GridLayout(2,3);
        northpanel.setLayout(toplayout);
        northpanel.add(restartbutton);
        northpanel.add(playerbutton);
 	northpanel.add(humanplayersbutton);
	northpanel.add(stationbutton);
        northpanel.add(AIbutton);        
        //northpanel.add(sizebutton);
        //northpanel.add(planetbutton);
        //northpanel.add(scenairiobutton);
        northpanel.add(optionsbutton);
        southpanel.setLayout(bottomlayout);
        southpanel.add(horiz1);
        southpanel.add(firebutton);
        southpanel.add(hyperspacebutton);
        southpanel.add(horiz2);

        topgap=toplayout.minimumLayoutSize(northpanel).height;
        bottomgap=bottomlayout.minimumLayoutSize(northpanel).height;

        topgapoverconv=topgap/conv;
        bottomgapoverconv=bottomgap/conv;



        restartbutton.addActionListener(this);
        restartbutton.addKeyListener(this);
        restartbutton.addFocusListener(this);
        restartbutton.addMouseListener(this);

        playerbutton.addActionListener(this);
        playerbutton.addKeyListener(this);
        playerbutton.addFocusListener(this);
        playerbutton.addMouseListener(this);

        humanplayersbutton.addActionListener(this);
        humanplayersbutton.addKeyListener(this);
        humanplayersbutton.addFocusListener(this);
        humanplayersbutton.addMouseListener(this);

        stationbutton.addActionListener(this);
        stationbutton.addKeyListener(this);
        stationbutton.addFocusListener(this);
        stationbutton.addMouseListener(this);

        AIbutton.addActionListener(this);
        AIbutton.addKeyListener(this);
        AIbutton.addFocusListener(this);
        AIbutton.addMouseListener(this);

        optionsbutton.addActionListener(this);
        optionsbutton.addKeyListener(this);
        optionsbutton.addFocusListener(this);
        optionsbutton.addMouseListener(this);

        horiz1.addAdjustmentListener(this);
        horiz1.addKeyListener(this);
        horiz1.addFocusListener(this);
        horiz1.addMouseListener(this);

        horiz2.addAdjustmentListener(this);
        horiz2.addKeyListener(this);
        horiz2.addFocusListener(this);
        horiz2.addMouseListener(this);

        firebutton.addActionListener(this);
        firebutton.addKeyListener(this);
        firebutton.addFocusListener(this);
        firebutton.addMouseListener(this);

        hyperspacebutton.addActionListener(this);
        hyperspacebutton.addKeyListener(this);
        hyperspacebutton.addFocusListener(this);
        hyperspacebutton.addMouseListener(this);

        listenmode=1;

	//hyperspacebutton.setBackground(Color.blue);
	//hyperspacebutton.setForeground(Color.green );

	
        firstgo=1;
        initilise();
	//makes it execute the run() method
        main=new Thread(this);
        //addKeyListener(this);
        //addKeyListener(this);
        addKeyListener(this);
        addFocusListener(this);
        addMouseListener(this);
	//the next line creates an image that is the same
	//size as the applet
	buffer=createImage(getSize().width,getSize().height);
	buffer2=createImage(getSize().width,getSize().height);

	//the next makes bufferg be the Graphics of the
	//Image named buffer
	bufferg=buffer.getGraphics();
        buffer2g=buffer2.getGraphics();
       //   Font bigfont=new Font("Courier",Font.BOLD,34);
         //   FontMetrics bigfm = buffer2g.getFontMetrics(bigfont);
	//    FontMetrics bigfm;
	//  FontMetrics smallfm;
        //Font smallfont=new Font("Serif",Font.BOLD,18);
 nf.setMaximumFractionDigits(1); 
 nf.setMinimumFractionDigits(1); 
        for(int i=1;i<maxnplayers;i++){
          stationturns[i]=0;
          stationowngoals[i]=0;
          stationsuicide[i]=0;
          stationkills[i]=0;
          stationshots[i]=0;
          stationkilledby[i]=-1;
          stationsurvive[i]=0;
          teamscore[i]=0;
          teamturns[i]=0;
          teamowngoals[i]=0;
          teamsuicide[i]=0;
          teamshots[i]=0;
          teamkills[i]=0;
          teamsurvive[i]=0;
          teamwins[i]=0;

        }
        smallfont=new Font("Serif",Font.BOLD,smallsize);
        bigfont=new Font("Courier",Font.BOLD,bigsize);

        //if(screenwidth<600)smallfont=new Font("Arial",Font.PLAIN,smallsize);

        smallfm = buffer2g.getFontMetrics(smallfont);
        bigfm = buffer2g.getFontMetrics(bigfont);
        String str = " Set number of players, planets and which scenairio and then press the start button to begin play. ";
        while(smallfm.stringWidth(str)>screenwidth){
	    smallsize--;
            smallfont=new Font("Serif",Font.BOLD,smallsize);
            //if(screenwidth<600)smallfont=new Font("Serif",Font.PLAIN,smallsize);
            smallfm = buffer2g.getFontMetrics(smallfont);
        }
        str = " D E A T H   S T A R   B A T T L E S";
        while(bigfm.stringWidth(str)>screenwidth){
	    bigsize--;
            bigfont=new Font("Courier",Font.BOLD,bigsize);
            bigfm = buffer2g.getFontMetrics(bigfont);
        }
        running=false;
	main.start();   
    }

    public void start() {
        if(main!=null) main.setPriority(Thread.MAX_PRIORITY);
        running=true;
    }
    //the stop() method occurs when the Thread stops
    //public void stop(){
    //	if(main!=null){main.stop();}
    //}

    public void stop() {
        main.setPriority(main.MIN_PRIORITY);
        running=false;
    }

    public void destroy() {
        main.stop();
        main=null;
        running=false;
    } 
                  
    public void initilise(){
      double mindistance=10.0;
      double minplayerdistance=650.0;
      double minplanetdistance=10.0;
      double distance_reduction=0.15;

      double density1;
      double A,B,C,D,E,F;

      int attempts=0;
      int check=0;
      int areacount=0;
      int areacheck=0;
      double rnumber1;
      double rnumber2;
      double rnumber3;
      double rnumber4;
      double rnumber5;
      double rnumber6;
      double rnumber7;
      int choice;
      int initial;
     
      int shade;
      int impact;
      int temp1,temp2;

      startnew=0;
      turn=0;
      // remember the confustion between players, teams and stations!!!!!!!!

    if(tornamentmode==0||game==0){
      nteams=menunplayers;
      nplayersperteam=menunplayersperteam;  
      if(nteams*nplayersperteam>maxnplayers)nplayersperteam=(int)((double)maxnplayers/(double)menunplayers);
      nplayers=nteams*nplayersperteam;

    }
      if(menunplanets==maxnplanets+1){
        nplanets=(int)((Math.random()*Math.random()+Math.random())*0.5*9+0.9);
        if((nplanets==0||nplanets==1)&&Math.random()<0.9)nplanets++;
        if(nplanets>8)nplanets=8;
      }
      else if(menunplanets==maxnplanets+2){
        nplanets=(int)((Math.random()*Math.random()+Math.random())*0.5*(maxnplanets+1)+0.9);
        if((nplanets==0||nplanets==1)&&Math.random()<0.9)nplanets++;
        if(nplanets>maxnplanets)nplanets=maxnplanets;
      }
      else if(tornamentmode==0||game==0) nplanets=menunplanets;
      
      if(menusize==nsize+1)size=(int)((Math.random()+Math.random())*0.5*nsize+1);
      else if(tornamentmode==0||game==0) size=menusize;

      nhumanplayers=menunhumanplayers*nplayersperteam;
      if(nhumanplayers>nplayers)nhumanplayers=nplayers;
      AI=menuAI;
      if(nhumanplayers==0) allAI=true;
      else allAI=false;

      if(menuscenairio==nscenairios+1){
	  choice=(int)(Math.random()*100);
	    if(choice<25){         //common
          scenairio=(int)(Math.random()*5+1);
        }
	else if(choice<88){      //uncommon
          scenairio=(int)(Math.random()*13+1);
        }
	else{                        //rare
          scenairio=(int)(Math.random()*nscenairios+1);
        }

	//Adjust upwards number of asteroids
	if(scenairio==2&&menunplanets==maxnplanets+1&&Math.random()<0.95&&nplanets<4)nplanets+=4;
        else if(scenairio==2&&menunplanets==maxnplanets+2&&Math.random()<0.95&&nplanets<10)nplanets+=7;

        //Adjust upwards number of planets for big wormhole scenario
	if(scenairio==18&&menunplanets==maxnplanets+1&&Math.random()<0.9&&nplanets<3)nplanets+=2;
        else if(scenairio==18&&menunplanets==maxnplanets+2&&Math.random()<0.9&&nplanets<3)nplanets+=2;

	//Adjust upwards number of planets
	if(scenairio==1&&menunplanets==maxnplanets+1&&Math.random()<0.9&&nplanets<7)nplanets+=1;
        else if(scenairio==1&&menunplanets==maxnplanets+2&&Math.random()<0.9&&nplanets<14)nplanets+=1;
 
      }
      else if(tornamentmode==0||game==0) scenairio=menuscenairio;

    losingteam=-1;
    winningteam=-1;

    if(game==0){
      for(int i=0;i<nplayers;i++){
	leaderboard[i]=i;
        topteam=-1;
        bottomteam=-1;
        stationtotalpower[i]=0;
        stationvengencekills[i]=0;
        stationstrategykills[i]=0;
        stationtacticskills[i]=0;
        stationbullykills[i]=0;
        stationopressionkills[i]=0;
        stationlongshotkills[i]=0;
        stationcloseshotkills[i]=0;
        stationturns[i]=0;
        stationowngoals[i]=0;
        stationsuicide[i]=0;
        stationkills[i]=0;
        stationkilledby[i]=-1;
        stationshots[i]=0;
        stationsurvive[i]=0;
        teamscore[i]=0;
        teamturns[i]=0;
        teamowngoals[i]=0;
        teamsuicide[i]=0;
        teamkills[i]=0;
        teamshots[i]=0;
        teamsurvive[i]=0;
        teamwins[i]=0;

      }
    }   


      if(firstgo!=0) {AI=3;size=5;scenairio=9;nplanets=4;nhumanplayers=0;nplayersperteam=1;nteams=5;nplayers=nteams*nplayersperteam;}       

      player=0;
      
      for(int i=0;i<nplayers;i++){
        stationstatus[i]=1;
      }

      team=0;
      station=0;

      for(int i=0;i<nplayers;i++){
        stationteam[i]=team;
        stationnumber[i]=station;
        station++;
        if(station>=nplayersperteam){teamleader[team]=i;team++;station=0;}
      }
    
      if(nplayers==2){minplayerdistance=450.0;distance_reduction=0.17;}
      else if(nplayers==3){minplayerdistance=450.0;distance_reduction=0.10;}
      else if(nplayers==4){minplayerdistance=300.0;distance_reduction=0.0625;}
      else if(nplayers==5){minplayerdistance=250.0;distance_reduction=0.05;}
      else if(nplayers==6){minplayerdistance=200.0;distance_reduction=0.0375;}
      else if(nplayers==7){minplayerdistance=200.0;distance_reduction=0.0375;}
      else if(nplayers==8){minplayerdistance=200.0;distance_reduction=0.0375;}
      else if(nplayers==9){minplayerdistance=150.0;distance_reduction=0.025;}
      else if(nplayers==10){minplayerdistance=150.0;distance_reduction=0.025;}
      else if(nplayers==11){minplayerdistance=120.0;distance_reduction=0.0175;}
      else {minplayerdistance=100.0;distance_reduction=0.0125;}
      
      for(int i=0;i<(nhumanplayers);i++){
        playerAI[i]=0;
      }
      for(int i=(nhumanplayers);i<nplayers;i++){
        playerAI[i]=AI;
      }
             
      for(int i=0;i<nplayers;i++){
        for(int j=0;j<nplayers;j++){
	  bestAIAngle[i][j]=0;
	  bestAIPower[i][j]=0;
        }
      }

      winner=-2;
      wipe=1;
      timestep=.15;
      step=0; 
      
      rnumber1=Math.random();
      rnumber2=Math.random();
      rnumber3=Math.random();
      rnumber4=Math.random();
      rnumber5=Math.random();
      rnumber6=Math.random();
      rnumber7=Math.random();
      
      //   printevery=20;
      G=0.2;
      
      //set seed
      seed=(int)(20000*Math.random());

      //set up star field
      if(size==1){  //half brighness & smaller for smallest station size to improve visibility
        for(int i=0;i<nstars;i++){
	  starx[i]=(int)(screenwidth*Math.random());
	  stary[i]=(int)(screenwidth*Math.random());	  
          starr[i]=(int)(conv*(6.0*Math.random()*Math.random()*Math.random()+1.4*Math.random()+1.4*Math.random()+2));
          starcolour[i]=new Color((int)(6*Math.random()+50*Math.random()),
                                  (int)(2*Math.random()+6*Math.random()),
                                  (int)(5*Math.random()+40*Math.random()));
        }
      }
      else{
        for(int i=0;i<nstars;i++){
	  starx[i]=(int)(screenwidth*Math.random());
	  stary[i]=(int)(screenwidth*Math.random());	  
          starr[i]=(int)(conv*(10.0*Math.random()*Math.random()*Math.random()+1.8*Math.random()+1.8*Math.random()+2));
          starcolour[i]=new Color((int)(14*Math.random()+95*Math.random()),
                                  (int)(3*Math.random()+12*Math.random()),
                                  (int)(10*Math.random()+80*Math.random()));
        }
      }

      //defaults
      A=1.0; B=0.0; C=0.0; 
      D=1.0; E=0.0; F=0.0; 
      for(int i=0;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
      for(int i=0;i<nplanets;i++)planethalo[i]=1.0;
      initial=0;
      shade=1;     
      density1=400;
      impact=1;
      attempts=0;
      while(check==0){
      if(scenairio==1){         //Planets
	  A=0.4; B=0.4; C=0.1; 
          D=30.0; E=30.0; F=10.0; 
	  initial=0;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
          shade=1;
          density1=0.03;
          impact=1;
          if(nplanets>10) nplanets=10;
      }
      else if(scenairio==2){    //Asteroids
	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=5.0; F=3.0; 
	  initial=0;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          density1=0.05;
          impact=1;
      }
      else if(scenairio==3){    //Star
	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=5.0; F=4.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
          shade=1;
          impact=1;
          density1=0.08;
          planetcolour[0]=new Color((int)(Math.random()*30)+205,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);
          planetdensity[0]=0.015;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+80.0);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=2;
          planetimpact[0]=1;
      }
      else if(scenairio==4){    //Binary Star
	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=5.0; F=4.0; 
	  initial=2;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          shade=1;
          impact=1;
          density1=0.08;
          planetcolour[0]=new Color((int)(Math.random()*30)+205,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);
          planetdensity[0]=0.01;
          planetx[0]=((0.3*Math.random()+0.3*Math.random())*width+0.2*width);
          planety[0]=((0.3*Math.random()+0.3*Math.random())*height+0.2*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+40.0);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=2;
          planetimpact[0]=1;

          planetcolour[1]=new Color((int)(Math.random()*30)+205,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);
          planetdensity[1]=0.01;
          planetx[1]=((0.3*Math.random()+0.3*Math.random())*width+0.2*width);
          planety[1]=((0.3*Math.random()+0.3*Math.random())*height+0.2*height);
          planetradius[1]=((80.0*Math.random()+80.0*Math.random())+40.0);
          planetIradius[1]=(int)(conv*planetradius[1]);
          if(planetIradius[1]==0) planetIradius[1]=1;
          planetM[1]=planetradius[1]*planetradius[1]*planetdensity[1];
          planetshading[1]=2;
          planetimpact[1]=1;

      }
          else if(scenairio==5){    //Jovian
	  A=1.0; B=0.0; C=0.0; 
          D=6.0; E=6.0; F=3.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,100,70);
          shade=1;
          density1=0.04;
          impact=1;
          planetimpact[0]=1;

          planetcolour[0]=new Color((int)(Math.random()*100)+145,(int)(Math.random()*125),(int)(Math.random()*55));
          planetdensity[0]=0.01;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+40.0);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=1;
      }          
      else if(scenairio==6){    //Super Giant Star
	  A=1.0; B=0.0; C=0.0; 
          D=30.0; E=5.0; F=9.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          shade=1;
          impact=1;
          density1=0.05;
          planetcolour[0]=new Color((int)(Math.random()*10)+245,(int)(Math.random()*245+10),(int)(Math.random()*45+0));
          
          planetx[0]=((3.0*Math.random()+0.0*Math.random())*width-1.0*width);
          planety[0]=((3.0*Math.random()+0.0*Math.random())*height-1.0*height);
          planetradius[0]=((0.2*Math.random()+0.2*Math.random())*height+1.5*height);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;

          
          
          planetM[0]=4000;
          planetdensity[0]=planetM[0]/(planetradius[0]*planetradius[0]);
          planetshading[0]=2;
          if(nplanets>14) nplanets=14;
          planetimpact[0]=1;

      }      
      else if(scenairio==7){    //Super Giant Binary
	  A=1.0; B=0.0; C=0.0; 
          D=10.0; E=10.0; F=9.0; 
	  initial=2;
          minplanetdistance=100.0/(nplanets+0.001);
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          shade=1;
          impact=1;
          density1=0.05;
          planetcolour[0]=new Color((int)(Math.random()*10)+245,(int)(Math.random()*245+0),(int)(Math.random()*45+0));
          
          planetx[0]=((3.0*Math.random()+0.0*Math.random())*width-1.0*width);
          planety[0]=((3.0*Math.random()+0.0*Math.random())*height-1.0*height);
          planetradius[0]=((0.2*Math.random()+0.2*Math.random())*height+1.5*height);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=4000;
          planetdensity[0]=planetM[0]/(planetradius[0]*planetradius[0]);
 
          planetshading[0]=2;
          planetimpact[0]=1;

//planetIradius[0]=(int)(conv*50.0);

          planetcolour[1]=new Color((int)(Math.random()*10)+245,(int)(Math.random()*245+0),(int)(Math.random()*45+0));
          planetdensity[1]=planetdensity[0];
          planetx[1]=((3.0*Math.random()+0.0*Math.random())*width-1.0*width);
          planety[1]=((3.0*Math.random()+0.0*Math.random())*height-1.0*height);
          planetradius[1]=((0.2*Math.random()+0.2*Math.random())*height+1.5*height);
          planetIradius[1]=(int)(conv*planetradius[1]);
          if(planetIradius[1]==0) planetIradius[1]=1;
          planetM[1]=(planetradius[1])*(planetradius[1])*planetdensity[1];
          planetshading[1]=2;
          planetimpact[1]=1;

          if(nplanets>12) nplanets=12;
      }      
      else if(scenairio==8){    //Uneven binary
	  A=1.0; B=0.0; C=0.0; 
          D=10.0; E=10.0; F=9.0; 
	  initial=2;
          minplanetdistance=100/(nplanets+0.001);
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          shade=1;
          impact=1;
          density1=0.05;
          planetcolour[0]=new Color((int)(Math.random()*10)+245,(int)(Math.random()*245+0),(int)(Math.random()*45+0));
          planetx[0]=((3.0*Math.random()+0.0*Math.random())*width-1.0*width);
          planety[0]=((3.0*Math.random()+0.0*Math.random())*height-1.0*height);
          planetradius[0]=((0.2*Math.random()+0.2*Math.random())*height+1.5*height);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
	  
          planetM[0]=4000;
          planetdensity[0]=planetM[0]/(planetradius[0]*planetradius[0]);
          planetshading[0]=2;
          planetimpact[0]=1;

          planetcolour[1]=new Color((int)(Math.random()*30)+205,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);
          planetdensity[1]=0.020;
          planetx[1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[1]=(80.0*Math.random()+80.0*Math.random()+50.0);
          planetIradius[1]=(int)(conv*planetradius[1]);
          if(planetIradius[1]==0) planetIradius[1]=1;
          planetM[1]=planetradius[1]*planetradius[1]*planetdensity[1];
          planetshading[1]=2;
          planetimpact[1]=1;


          if(nplanets>13) nplanets=13;
      }      
      else if(scenairio==9){    //Red Giant Star
	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=5.0; F=4.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          shade=1;
          impact=1;
          density1=0.065;
          planetcolour[0]=new Color((int)(Math.random()*10)+245,(int)(Math.random()*115),(int)(Math.random()*025));
          planetdensity[0]=0.015;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+140.0);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=2;
          planetimpact[0]=1;

      }      
      else if(scenairio==10){    //Star Cluster
	  A=1.2; B=0.0; C=-0.1; 
          D=70.0; E=70.0; F=30.0; 
	  initial=0;
          shade=2;
          impact=1;
          for(int i=initial;i<nplanets;i++){
            planetcolour[i]=new Color((int)(Math.random()*30)+215,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);

          }
          density1=0.015;
          if(nplanets>8) nplanets=8;
      }      
      else if(scenairio==11){    //Mixture
	A=1.2; B=0.0; C=-0.1; 
        D=70.0; E=70.0; F=30.0; 
	initial=(int)(nplanets*(0.6*Math.random()+0.6*Math.random()));
        if(initial>7) initial=7;
        if(initial==0) initial=1;
        for(int i=0;i<initial;i++){
        
          planetimpact[i]=1;
	    
          planetcolour[i]=new Color((int)(Math.random()*30)+215,(int)(Math.random()*30)+205,(int)(Math.random()*190)+15);
          planetx[i]=((A*Math.random()+B*Math.random())*width+C*width);
          planety[i]=((A*Math.random()+B*Math.random())*height+C*height);
          planetradius[i]=((D*Math.random()+E*Math.random())+F);
          planetIradius[i]=(int)(conv*planetradius[i]);
          if(planetIradius[i]==0) planetIradius[i]=1;
          planetdensity[i]=0.015;
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          planetshading[i]=2;
          
        }
	A=1.0; B=0.0; C=0.0; 
        D=20.0; E=5.0; F=4.0; 
        for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
        shade=1;
        impact=1;
        density1=0.1;
      }
      else if(scenairio==12){    //White Dwarf
	  A=1.0; B=0.0; C=0.0; 
          D=5.0; E=5.0; F=3.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(160,100,70);
          density1=0.5;
          shade=1;
          impact=1;
          planetimpact[0]=1;
          planetcolour[0]=new Color((int)(255),(int)(255),(int)(255));
          planetdensity[0]=0.014;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+140.5); //radius reduced at end of initialise
          planetIradius[0]=(int)(Math.random()*3.0+7.0);
          
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=2;
      }
      else if(scenairio==13){    //Wormhole
	  if(rnumber1<0.75&&nplanets>1){       //purple paired 75%

	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=20.0; F=3.0; 
	  initial=2;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
          density1=0.03;
          shade=1;
          impact=1;
          planetimpact[0]=-1;
          planetcolour[0]=new Color((int)(255),(int)(55),(int)(255));
          planetdensity[0]=0.08;
          planetx[0]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[0]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[0]=((10.0*Math.random()+10.0*Math.random())+10.0);
          planetIradius[0]=(int)(2*planetradius[0]*conv);
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=3;

          planetimpact[1]=0;
          planetcolour[1]=new Color((int)(255),(int)(55),(int)(255));
          planetdensity[1]=0.08;
          planetx[1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[1]=planetradius[0];
          planetIradius[1]=(int)(2*planetradius[1]*conv);
          
          planetM[1]=planetM[0];
          planetshading[1]=3;
        }
	else if(rnumber1<0.9&&nplanets>2){     //blue cyclic 15%

	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=20.0; F=3.0; 
	  initial=3;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
          density1=0.03;
          shade=1;
          impact=1;
          planetimpact[0]=-2;
          planetcolour[0]=new Color((int)(55),(int)(55),(int)(255));
          planetdensity[0]=0.08;
          planetx[0]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[0]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[0]=((10.0*Math.random()+10.0*Math.random())+10.0);
          planetIradius[0]=(int)(2*planetradius[0]*conv);
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=3;

          planetimpact[1]=0;
          planetcolour[1]=new Color((int)(55),(int)(55),(int)(255));
          planetdensity[1]=0.08;
          planetx[1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[1]=planetradius[0];
          planetIradius[1]=(int)(2*planetradius[1]*conv);
          planetM[1]=planetM[0];
          planetshading[1]=3;

          planetimpact[2]=-1;
          planetcolour[2]=new Color((int)(55),(int)(55),(int)(255));
          planetdensity[2]=0.08;
          planetx[2]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
          planety[2]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
          planetradius[2]=planetradius[0];
          planetIradius[2]=(int)(2*planetradius[2]*conv);          
          planetM[2]=planetM[0];
          planetshading[2]=3;
        }
        else if(rnumber1<0.96){     //green random teleport 6%
	  A=1.0; B=0.0; C=0.0; 
          D=18.0; E=18.0; F=3.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(150,120,80);
          density1=0.03;
          shade=1;
          impact=1;
          planetimpact[0]=3;
          planetcolour[0]=new Color((int)(55),(int)(255),(int)(55));
          planetdensity[0]=0.08;
          planetx[0]=((0.2*Math.random()+0.2*Math.random())*width+0.3*width);
          planety[0]=((0.2*Math.random()+0.2*Math.random())*height+0.3*height);
          planetradius[0]=((15.0*Math.random()+15.0*Math.random())+15.0);
          planetIradius[0]=(int)(2*planetradius[0]*conv);
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=3;
        }
        else{                       //yellow self 4%
	  A=1.0; B=0.0; C=0.0; 
          D=18.0; E=18.0; F=3.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);;
          density1=0.03;
          shade=1;
          impact=1;
          planetimpact[0]=0;
          planetcolour[0]=new Color((int)(255),(int)(255),(int)(55));
          planetdensity[0]=0.08;
          planetx[0]=((0.2*Math.random()+0.2*Math.random())*width+0.3*width);
          planety[0]=((0.2*Math.random()+0.2*Math.random())*height+0.3*height);
          planetradius[0]=((15.0*Math.random()+15.0*Math.random())+15.0);
          planetIradius[0]=(int)(2*planetradius[0]*conv);
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=3;
        }
      }      
      else if(scenairio==14){    //White Dwarfs
	  A=0.9; B=0.0; C=0.1; 
          D=3.0; E=3.0; F=4.0; 
	  initial=0;
          density1=3;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(255,255,255);
          shade=2;
          impact=1;
      }
      else if(scenairio==15){    //Black Hole
	  A=1.0; B=0.0; C=0.0; 
          D=6.0; E=6.0; F=1.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(160,100,70);
          shade=1;
          density1=0.5;
          impact=1;
          planetimpact[0]=2;
          planetcolour[0]=new Color((int)(0),(int)(0),(int)(0));
          planetdensity[0]=0.02;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+140.0); //radius reduced at end of initialise
          planetIradius[0]=(int)(3);
          
          planetM[0]=planetradius[0]*planetradius[0]*planetdensity[0];
          planetshading[0]=0;
      }
      else if(scenairio==16){    //Black Holes
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=3.0; 
	  initial=0;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(0,0,0);
          shade=0;
          density1=50;
          impact=2;
      }      
      else if(scenairio==17){    //Wormholes
	if(rnumber1<0.40&&nplanets>1){ //paired wormholes 40% purple
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
	for(int i=1;i<nplanets;i+=2){ 
          planetimpact[i]=-(i-1);
          planetcolour[i]=new Color((int)(255),(int)(55),(int)(255));
          planetdensity[i]=0.08;
          planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
          planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
          planetradius[i]=((10.0*Math.random()+10.0*Math.random())+10.0);
          planetIradius[i]=(int)(2*planetradius[i]*conv);
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          planetshading[i]=3;

          planetimpact[i-1]=-i;
          planetcolour[i-1]=new Color((int)(255),(int)(55),(int)(255));
          planetdensity[i-1]=0.08;
          planetx[i-1]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
          planety[i-1]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
          planetradius[i-1]=planetradius[i];
          planetIradius[i-1]=(int)(2*planetradius[i]*conv);
          
          planetM[i-1]=planetM[i];
          planetshading[i-1]=3;

          initial=i;
        }
        if(initial!=nplanets-1)nplanets--;
        initial=nplanets;
       }
       else if(rnumber1<0.70){ //cyclic wormholes 30% blue
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
        for(int i=0;i<nplanets;i++){
	  if(i==0)planetimpact[i]=-(nplanets-1);
          else planetimpact[i]=-(i-1);
          planetcolour[i]=new Color((int)(55),(int)(55),(int)(255));
          planetdensity[i]=0.08;
          planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
          planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
          planetradius[i]=((10.0*Math.random()+10.0*Math.random())+10.0);
          planetIradius[i]=(int)(2*planetradius[i]*conv);
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          planetshading[i]=3;
        }
        initial=nplanets;
       }
       else if(rnumber1<0.85){ //random destination wormholes 15% red
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
        for(int i=0;i<nplanets;i++){
          planetimpact[i]=-(int)(Math.random()*(nplanets-1));
          planetcolour[i]=new Color((int)(255),(int)(55),(int)(55));
          planetdensity[i]=0.08;
          planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
          planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
          planetradius[i]=((10.0*Math.random()+10.0*Math.random())+10.0);
          planetIradius[i]=(int)(2*planetradius[i]*conv);
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          planetshading[i]=3;
        }
        initial=nplanets;
       }
       else if(rnumber1<0.90){ //random location wormholes 5% green
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
          for(int i=0;i<nplanets;i++){
            planetimpact[i]=3;
            planetcolour[i]=new Color((int)(55),(int)(255),(int)(55));
            planetdensity[i]=0.08;
            planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
            planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
            planetradius[i]=((10.0*Math.random()+10.0*Math.random())+15.0);
            planetIradius[i]=(int)(2*planetradius[i]*conv);
            planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
            planetshading[i]=3;
	  }
	}
       else if(rnumber1<0.95){ //changing random destination wormholes 5% grey
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
          for(int i=0;i<nplanets;i++){
            planetimpact[i]=4;
            planetcolour[i]=new Color((int)(155),(int)(155),(int)(155));
            planetdensity[i]=0.08;
            planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
            planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
            planetradius[i]=((10.0*Math.random()+10.0*Math.random())+10.0);
            planetIradius[i]=(int)(2*planetradius[i]*conv);
            planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
            planetshading[i]=3;
	  }
	}
       else { //self wormholes 5% yellow
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
          for(int i=0;i<nplanets;i++){
            planetimpact[i]=-i;
            planetcolour[i]=new Color((int)(255),(int)(255),(int)(55));
            planetdensity[i]=0.08;
            planetx[i]=((0.7*Math.random()+0.2*Math.random())*width+0.05*width);
            planety[i]=((0.7*Math.random()+0.2*Math.random())*height+0.05*height);
            planetradius[i]=((10.0*Math.random()+10.0*Math.random())+15.0);
            planetIradius[i]=(int)(2*planetradius[i]*conv);
            planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
            planetshading[i]=3;
	  }
	}
      }
       else if(scenairio==18){    //Super Wormhole Pair
	  A=1.0; B=0.0; C=0.0; 
          D=20.0; E=20.0; F=9.0; 
	  initial=2;
          minplanetdistance=100.0/(nplanets+0.001);
          
          shade=1;
          impact=1;
          density1=0.07;
          planetcolour[0]=new Color((int)(255),(int)(55),(int)(255));
          
          planetx[0]=((3.0*Math.random()+0.0*Math.random())*width-1.0*width);
          planety[0]=((3.0*Math.random()+0.0*Math.random())*height-1.0*height);
          planetradius[0]=((0.2*Math.random()+0.2*Math.random())*height+1.5*height);
          planetIradius[0]=(int)(conv*planetradius[0]);
          if(planetIradius[0]==0) planetIradius[0]=1;
          planetM[0]=4000;
          planetdensity[0]=planetM[0]/(planetradius[0]*planetradius[0]);
 
          planetshading[0]=3;
          planetimpact[0]=-1;

          planetIradius[0]=(int)(conv*50.0);

          planetcolour[1]=new Color((int)(255),(int)(55),(int)(255));
          planetdensity[1]=planetdensity[0];
          planetx[1]=width-planetx[0];
          planety[1]=height-planety[0];
          planetradius[1]=planetradius[0];
          planetIradius[1]=(int)(conv*planetradius[1]);
          if(planetIradius[1]==0) planetIradius[1]=1;
          planetM[1]=(planetradius[1])*(planetradius[1])*planetdensity[1];
          planetshading[1]=3;
          planetimpact[1]=0;
planetIradius[1]=(int)(conv*50.0);

          if(nplanets==1||rnumber1<0.1){
            planetimpact[0]=3;
            initial=1;
            planetcolour[0]=new Color((int)(55),(int)(255),(int)(55));
            for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(120,80,10);
          }
          else if(rnumber1<0.2){
            planetcolour[0]=new Color((int)(55),(int)(255),(int)(55));
            planetcolour[1]=new Color((int)(55),(int)(255),(int)(55));
            planetimpact[0]=3;
            planetimpact[1]=3;
          }


          if(nplanets>12) nplanets=12;
      }      
      else if(scenairio==19){    //White Hole
	  A=1.0; B=0.0; C=0.0; 
          D=16.0; E=16.0; F=1.0; 
	  initial=1;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(160,100,70);
          shade=1;
          density1=0.06;
          impact=1;
          planethalo[0]=15.0;
          planetimpact[0]=2;
          planetcolour[0]=new Color((int)(255),(int)(255),(int)(255));
          planetdensity[0]=0.02;
          planetx[0]=((0.1*Math.random()+0.1*Math.random())*width+0.4*width);
          planety[0]=((0.1*Math.random()+0.1*Math.random())*height+0.4*height);
          planetradius[0]=((80.0*Math.random()+80.0*Math.random())+140.0); //radius reduced at end of initialise
          planetIradius[0]=(int)(6);
          
          planetM[0]=-20;
          planetshading[0]=2;
      }
      else if(scenairio==20){    //White Holes
	  A=0.9; B=0.0; C=0.1; 
          D=3.0; E=3.0; F=4.0; 
	  initial=0;
          density1=-0.2;
          for(int i=initial;i<nplanets;i++)planetcolour[i]=new Color(255,255,255);
          for(int i=initial;i<nplanets;i++)planethalo[i]=15.0;
          shade=2;
          impact=1;
      }
     else if(scenairio==21){    //Hyperspace
	  A=0.9; B=0.0; C=0.1; 
          D=0.0; E=0.0; F=5.0; 
	  initial=nplanets;
        for(int i=0;i<nplanets;i++){
	    if(Math.random()<0.5)planetdensity[i]=6*Math.random();
            else planetdensity[i]=-5*Math.random();
          if(planetdensity[i]<0.0)planetcolour[i]=new Color(255,255+(int)(50*planetdensity[i]),0);
          if(planetdensity[i]>0.0)planetcolour[i]=new Color((int)(255-40*planetdensity[i]),255,0);
          if(rnumber1<0.8)planetimpact[i]=2;
          else planetimpact[i]=4;
          planetx[i]=((A*Math.random()+B*Math.random())*width+C*width);
          planety[i]=((A*Math.random()+B*Math.random())*height+C*height);
          planetradius[i]=((D*Math.random()+E*Math.random())+F);
          if(rnumber1<0.8)planetIradius[i]=(int)(conv*planetradius[i]);
          else planetIradius[i]=(int)(2*planetradius[i]);
          if(planetIradius[i]==0) planetIradius[i]=1;
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          if(rnumber1<0.8)planetshading[i]=2;
          else planetshading[i]=3;
        }
      }


      

	check=1;
      	for(int i=initial;i<nplanets;i++){
	    //planetcolour[i]=col1;          
	  planetdensity[i]=density1;
          planetx[i]=((A*Math.random()+B*Math.random())*width+C*width);
          planety[i]=((A*Math.random()+B*Math.random())*height+C*height);
          planetradius[i]=((D*Math.random()+E*Math.random())+F);
          planetIradius[i]=(int)(conv*planetradius[i]);
          if(planetIradius[i]==0) planetIradius[i]=1;
          planetM[i]=planetradius[i]*planetradius[i]*planetdensity[i];
          planetshading[i]=shade;
          planetimpact[i]=impact;

          
        }

        //Add random features here -------------------------------------------------
        if(rnumber2<0.1){
          if(rnumber3<0.25&&nplanets>2){ //wormhole pair

            initial=(int)(rnumber4*(nplanets-2))+1;
            planetimpact[initial]=-(initial+1);
            planetcolour[initial]=new Color((int)(255),(int)(55),(int)(255));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((10.0*Math.random()+10.0*Math.random())+10.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;

            planetimpact[initial+1]=-(initial);
            planetcolour[initial+1]=new Color((int)(255),(int)(55),(int)(255));
            planetdensity[initial+1]=0.08;
            planetx[initial+1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+1]=planetradius[initial];
            planetIradius[initial+1]=(int)(2*planetradius[initial]*conv);          
            planetM[initial+1]=planetM[initial];
            planetshading[initial+1]=3;
          }
          else if(rnumber3<0.5&&nplanets>3){ //wormhole tripple
            initial=(int)(rnumber4*(nplanets-3))+1;

            planetimpact[initial]=-(initial+1);
            planetcolour[initial]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((10.0*Math.random()+10.0*Math.random())+10.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;

            planetimpact[initial+1]=-(initial+2);
            planetcolour[initial+1]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial+1]=0.08;
            planetx[initial+1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+1]=planetradius[initial];
            planetIradius[initial+1]=(int)(2*planetradius[initial+1]*conv);
            planetM[initial+1]=planetM[initial];
            planetshading[initial+1]=3;

            planetimpact[initial+2]=-(initial);
            planetcolour[initial+2]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial+2]=0.08;
            planetx[initial+2]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+2]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+2]=planetradius[initial];
            planetIradius[initial+2]=(int)(2*planetradius[initial+2]*conv);          
            planetM[initial+2]=planetM[initial];
            planetshading[initial+2]=3;
          }
          else if(rnumber3<0.6&&nplanets>1){ //wormhole random (green)
            initial=(int)(rnumber4*(nplanets-1))+1;

            planetimpact[initial]=3;
            planetcolour[initial]=new Color((int)(55),(int)(255),(int)(55));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((15.0*Math.random()+15.0*Math.random())+15.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;
          }
          else if(rnumber3<0.90&&nplanets>1){ //white dwarf
            initial=(int)(rnumber4*(nplanets-1))+1;
            planetimpact[initial]=1;
            planetcolour[initial]=new Color((int)(255),(int)(255),(int)(255));
            planetdensity[initial]=3;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((3.0*Math.random()+3.0*Math.random())+4.0);
            planetIradius[initial]=(int)(conv*planetradius[initial]);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=2;
            for(int i=0;i<nplanets;i++){
		if(planetimpact[i]==-initial)planetimpact[i]=-i;
	    }
          }
          else if(nplanets>1){ //black hole
            initial=(int)(rnumber4*(nplanets-1))+1;
            planetimpact[initial]=2;
            planetcolour[initial]=new Color((int)(0),(int)(0),(int)(0));
            planetdensity[initial]=50;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=(3.0);
            planetIradius[initial]=(int)(conv*planetradius[initial]);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=0;
            for(int i=0;i<nplanets;i++){
		if(planetimpact[i]==-initial)planetimpact[i]=-i;
	    }
          }
        }//if random feature 1 present
        //Add random feature 2 here -------------------------------------------------
        if(rnumber2<0.1&&rnumber5<0.35){
          if(rnumber6<0.25&&nplanets>2){ //wormhole pair

            initial=(int)(rnumber7*(nplanets-2))+1;
            planetimpact[initial]=-(initial+1);
            planetcolour[initial]=new Color((int)(255),(int)(55),(int)(255));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((10.0*Math.random()+10.0*Math.random())+10.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;

            planetimpact[initial+1]=-(initial);
            planetcolour[initial+1]=new Color((int)(255),(int)(55),(int)(255));
            planetdensity[initial+1]=0.08;
            planetx[initial+1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+1]=planetradius[initial];
            planetIradius[initial+1]=(int)(2*planetradius[initial]*conv);          
            planetM[initial+1]=planetM[initial];
            planetshading[initial+1]=3;
          }
          else if(rnumber6<0.5&&nplanets>3){ //wormhole tripple
            initial=(int)(rnumber7*(nplanets-3))+1;

            planetimpact[initial]=-(initial+1);
            planetcolour[initial]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((10.0*Math.random()+10.0*Math.random())+10.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;

            planetimpact[initial+1]=-(initial+2);
            planetcolour[initial+1]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial+1]=0.08;
            planetx[initial+1]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+1]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+1]=planetradius[initial];
            planetIradius[initial+1]=(int)(2*planetradius[initial+1]*conv);
            planetM[initial+1]=planetM[initial];
            planetshading[initial+1]=3;

            planetimpact[initial+2]=-(initial);
            planetcolour[initial+2]=new Color((int)(55),(int)(55),(int)(255));
            planetdensity[initial+2]=0.08;
            planetx[initial+2]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial+2]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial+2]=planetradius[initial];
            planetIradius[initial+2]=(int)(2*planetradius[initial+2]*conv);          
            planetM[initial+2]=planetM[initial];
            planetshading[initial+2]=3;
          }
          else if(rnumber6<0.7&&nplanets>1){ //wormhole random (green)
            initial=(int)(rnumber7*(nplanets-1))+1;

            planetimpact[initial]=3;
            planetcolour[initial]=new Color((int)(55),(int)(255),(int)(55));
            planetdensity[initial]=0.08;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((15.0*Math.random()+15.0*Math.random())+15.0);
            planetIradius[initial]=(int)(2*planetradius[initial]*conv);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=3;
          }
          else if(rnumber6<0.93&&nplanets>1){ //white dwarf
            initial=(int)(rnumber7*(nplanets-1))+1;
            planetimpact[initial]=1;
            planetcolour[initial]=new Color((int)(255),(int)(255),(int)(255));
            planetdensity[initial]=3;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=((3.0*Math.random()+3.0*Math.random())+4.0);
            planetIradius[initial]=(int)(conv*planetradius[initial]);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=2;
            for(int i=0;i<nplanets;i++){
		if(planetimpact[i]==-initial)planetimpact[i]=-i;
	    }
          }
          else if(nplanets>1){ //black hole
            initial=(int)(rnumber7*(nplanets-1))+1;
            planetimpact[initial]=2;
            planetcolour[initial]=new Color((int)(0),(int)(0),(int)(0));
            planetdensity[initial]=50;
            planetx[initial]=((0.4*Math.random()+0.4*Math.random())*width+0.1*width);
            planety[initial]=((0.4*Math.random()+0.4*Math.random())*height+0.1*height);
            planetradius[initial]=(3.0);
            planetIradius[initial]=(int)(conv*planetradius[initial]);
            planetM[initial]=planetradius[initial]*planetradius[initial]*planetdensity[initial];
            planetshading[initial]=0;
            for(int i=0;i<nplanets;i++){
		if(planetimpact[i]==-initial)planetimpact[i]=-i;
	    }
          }
        }//if random feature 2 present

        //planet planet check
	for(int i=0;i<nplanets;i++){
	  for(int j=0;j<nplanets;j++){
	    if(j!=i&&((planetx[i]-planetx[j])*(planetx[i]-planetx[j])+(planety[i]-planety[j])*(planety[i]-planety[j]))<((minplanetdistance+planetradius[i]+planetradius[j])*(minplanetdistance+planetradius[i]+planetradius[j])))check=0;
	  }
        }
        //free area check - check that at least ~25% of board is free
        areacount=0;
	for(int i=0;i<20;i++){
	  for(int j=0;j<20;j++){
            areacheck=1;
	    for(int k=0;k<nplanets;k++){
		if(((i*width)/20.0-planetx[k])*((i*width)/20.0-planetx[k])+((j*height)/20.0-planety[k])*((j*height)/20.0-planety[k])<(planetradius[k]*planetradius[k]))areacheck=0;
	    }
            if(areacheck==1)areacount++;
	  }
        }
        if(areacount<80)check=0;
              if(Math.IEEEremainder(attempts,400)==0.)
              {
	        try{main.sleep(100);}
	        catch(Exception e){}
	      }
    	      attempts++;
              if(attempts>1000){nplanets--;attempts=0;}
              if(nplanets<0)check=1;;
      }//while check=0

      percentfree=areacount/400.0;
      attempts=0;
      check=0;
      while(check==0){
	check=1;
        for(int i=0;i<nplayers;i++){
	    oldstationx[i]=-width;
	    oldstationy[i]=-height;
          stationx[i]=(int)((0.8*Math.random()+0.075*Math.random())*width+0.075*width);
          stationy[i]=(int)((0.8*Math.random()+0.075*Math.random())*height+0.075*height);
          stationstatus[i]=1;
          if(size==1)stationradius[i]=(5.);
          if(size==2)stationradius[i]=(8.);
          if(size==3)stationradius[i]=(10.);
          if(size==4)stationradius[i]=(12.);
          if(size==5)stationradius[i]=(16.);
          if(size==6)stationradius[i]=(24.);
          stationIradius[i]=(int)(stationradius[i]*conv);    
          
          if(stationIradius[i]==0) stationIradius[i]=1;
          stationboxradius[i]=3*stationIradius[i];
          if(stationboxradius[i]<actingIradius)stationboxradius[i]=30;
          stationarrowminradius[i]=(int)(1.2*stationradius[i]*conv);
          if(stationarrowminradius[i]<10)stationarrowminradius[i]=10;
          
          Power[i]=1;
          Angle[i]=180;
          LastAngle[i]=Angle[i];
	  LastPower[i]=Power[i];
	  if(stationteam[i]==0)stationcolour[i]=new Color(0,220,0);     //green
	  if(stationteam[i]==1)stationcolour[i]=new Color(0,195,195);   //cyan       
	  if(stationteam[i]==2)stationcolour[i]=new Color(255,255,0);   //yellow
	  if(stationteam[i]==3)stationcolour[i]=new Color(255,10,10);     //red
	  if(stationteam[i]==4)stationcolour[i]=new Color(225,0,225);   //purple
          if(stationteam[i]==5)stationcolour[i]=new Color(0,0,250);     //blue
          if(stationteam[i]==6)stationcolour[i]=new Color(255,162,0);   //orange
          if(stationteam[i]==7)stationcolour[i]=new Color(155,155,155); //grey    
          if(stationteam[i]==8)stationcolour[i]=new Color(242,242,242);  //white    
          if(stationteam[i]==9)stationcolour[i]=new Color(88,88,88);     //black 
          if(stationteam[i]==10)stationcolour[i]=new Color(255,155,155); //pink 
          if(stationteam[i]==11)stationcolour[i]=new Color(205,95,0);  //brown 
          if(stationteam[i]==12)stationcolour[i]=new Color(0,115,115);    //turquoise 
          teamcolour[stationteam[i]]=stationcolour[i];
	  //playerstatus[i]=1;
          if(size==1)radius[i]=(1.0);
          if(size==2)radius[i]=(1.2);
          if(size==3)radius[i]=(1.5);
          if(size==4)radius[i]=(2.0);
          if(size==5)radius[i]=(2.6);
          if(size==6)radius[i]=(3.4);
          Iradius[i]=(int)(radius[i]*conv);
          if(Iradius[i]<1)Iradius[i]=1;
          xvelocity[i]=0.0;
          yvelocity[i]=0.0;
          x[i]=0.0;
          y[i]=0.0;
          oldy[i]=0.0;
          oldx[i]=0.0;
          pathl[i]=0;
          numberofteleports[i]=0;
          voldy[i]=0.0;
          voldx[i]=0.0;
          status[i]=0;
          stationhyperspace[i]=0; 
        }
	//station station check
	for(int i=0;i<nplayers;i++){
	  for(int j=0;j<nplayers;j++){
	      if(j!=i&&(((stationx[i]-stationx[j])*(stationx[i]-stationx[j])+(stationy[i]-stationy[j])*(stationy[i]-stationy[j])<minplayerdistance*minplayerdistance&&stationteam[i]!=stationteam[j])||(stationx[i]-stationx[j])*(stationx[i]-stationx[j])+(stationy[i]-stationy[j])*(stationy[i]-stationy[j])<(minplayerdistance*minplayerdistance*0.25))){
                 if(check==1)minplayerdistance=minplayerdistance-distance_reduction;
                 check=0;
                 if(minplayerdistance<60.0)minplayerdistance=60.0;
                 //poo=minplayerdistance; //for debugging can be removed
                 //testint=attempts;      //for debugging can be removed
              }
	  }
        }
        //station planet check
	for(int i=0;i<nplayers;i++){
	  for(int j=0;j<nplanets;j++){
	    if(((stationx[i]-planetx[j])*(stationx[i]-planetx[j])+(stationy[i]-planety[j])*(stationy[i]-planety[j]))<((stationradius[i]+planetradius[j])*(stationradius[i]+planetradius[j])))check=0;
	  }
        }
              if(Math.IEEEremainder(attempts,800)==0.)
              {
	        try{main.sleep(100);}
	        catch(Exception e){}
	      }

              attempts++;
              if(attempts>4000){
                  poo=-minplayerdistance;
                  for(int i=0;i<nplayers;i++){
                    stationhyperspace[i]=1;
                  }
		  hyperspace();
		  for(int i=0;i<nplayers;i++){
                    stationstatus[i]=1;
                    stationcount[i]=0;
                  }
              check=1;
              }
      }//while check=0

      if(scenairio==12)planetradius[0]=planetIradius[0];
      if(scenairio==15)planetradius[0]=planetIradius[0];
      if(scenairio==19)planetradius[0]=planetIradius[0];
 
    horiz1.setValue(360-Angle[player]);
    horiz2.setValue(Power[player]);
    totalmass=0;
	for(int i=0;i<nplanets;i++){
	  totalmass=totalmass+planetM[i];
        }     

	//playerAI[0]=1;
newturn();
for(int i=0;i<nplayers;i++){
     stationstatus[i]=3;
     stationcount[i]=13;
}
    mode=0;
    listenmode=1;
    game++;
    }
                                      
   public void focusGained(FocusEvent evt) {
         // The applet now has the input focus.
       focused=true;
   }
   

   public void focusLost(FocusEvent evt) {
         // The applet has now lost the input focus.
      focused=false;
   }

public void mouseClicked(MouseEvent evt)
    { //if(winner!=-2&&mode==0&&tornamentmode==1&&game!=0)startnew=1;
    }
public void mouseReleased(MouseEvent evt)
    {
    }
public void mouseEntered(MouseEvent evt)
    {
    }
public void mouseExited(MouseEvent evt)
    {
    }

public void mousePressed(MouseEvent evt) {
      double deltaX;
      double deltaY;
      double theta;
      double length;
      double fraction;
      double sign;
    requestFocus();
    if(winner!=-2&&mode==0&&tornamentmode==1&&game!=0)startnew=1;
    if(Qdown&&Wdown){
      stationx[currentplayer]=evt.getX()/conv;
      stationy[currentplayer]=evt.getY()/conv;
    }
    else if(mode==0&&playerAI[player]==0&&listenmode==1&&player<nplayers){
      deltaX=evt.getX()/conv-stationx[player];
      deltaY=evt.getY()/conv-stationy[player];
      sign=1.f;
      if(deltaX<0.0)sign=-1.f;
      theta=-(int)(180*Math.atan(deltaY/deltaX)/(Math.PI))+180-(int)(sign*90);
      length=Math.sqrt(deltaX*deltaX+deltaY*deltaY)*conv;
      if(length<(1.2*stationboxradius[player])&&length>(1.0*stationIradius[player])){
        Angle[player]=(int)theta;
        horiz1.setValue(360-Angle[player]);
        fraction=(length-1.0*stationarrowminradius[player])/(1.0*stationboxradius[player]-1.0*stationarrowminradius[player]);
	    if(fraction<0.0)fraction=0.0;
            if(fraction>1.0)fraction=1.0;
	    Power[player]=(int)(800.0*fraction)+1;
            horiz2.setValue(Power[player]);
      }
    }
}              

  //this is the method we want for our arrow keys
public void keyPressed(KeyEvent e) {
   //lets take out the code of which key was pressed.
   int keyCode = e.getKeyCode();
   keydown=e.getKeyCode();
   if(mode==0&&playerAI[player]==0&&listenmode==1&&player<nplayers){             
     switch(keyCode){
       case java.awt.event.KeyEvent.VK_K:    //k
         Power[player]++;
         if(Power[player]>800)Power[player]=800;
         horiz2.setValue(Power[player]);
       break;
       case java.awt.event.KeyEvent.VK_M:    //m
         Power[player]--;
         if(Power[player]<0)Power[player]=0;
         horiz2.setValue(Power[player]);
       break;
       case java.awt.event.KeyEvent.VK_J:    //j
         Power[player]=Power[player]+10;
         if(Power[player]>800)Power[player]=800;
         horiz2.setValue(Power[player]);
       break;
       case java.awt.event.KeyEvent.VK_N:    //n
         Power[player]=Power[player]-10;
         if(Power[player]<0)Power[player]=0;
         horiz2.setValue(Power[player]);
       break;
     }

     switch(keyCode){
       case java.awt.event.KeyEvent.VK_Z:    //z
         Angle[player]++;
         if(Angle[player]>359)Angle[player]=0;
         horiz1.setValue(360-Angle[player]);
       break;
       case java.awt.event.KeyEvent.VK_X:    //x
         Angle[player]--;
         if(Angle[player]<0)Angle[player]=359;
         horiz1.setValue(360-Angle[player]);
       break;
       case java.awt.event.KeyEvent.VK_A:    //a
         Angle[player]=Angle[player]+5;
         if(Angle[player]>359)Angle[player]=Angle[player]-360;
         horiz1.setValue(360-Angle[player]);
       break;
       case java.awt.event.KeyEvent.VK_S:    //s
         Angle[player]=Angle[player]-5;
         if(Angle[player]<0)Angle[player]=Angle[player]+360;
         horiz1.setValue(360-Angle[player]);
       break;
     }
  
     switch(keyCode){
       case java.awt.event.KeyEvent.VK_H:    //H
	 if(listenmode==1){
	   if(stationhyperspace[player]==0)stationhyperspace[player]=1;
           else stationhyperspace[player]=0;
           try{main.sleep(100);}catch(Exception ex){}
         }
       break;
       case java.awt.event.KeyEvent.VK_ENTER:    //return
        if(firstgo==0&&winner==-2&&listenmode==1){
          player++;
          while(player<nplayers&&stationstatus[player]!=1){player++;}

	  while(playerAI[player]>0&&player<nplayers){
              //Angle[player]=(int)(360*Math.random());
              //Power[player]=(int)(80*Math.hrandom()+20);
              think();
	      player++;
          }

    	  if(player<nplayers) 
          {    horiz1.setValue(360-Angle[player]);
               horiz2.setValue(Power[player]);
	       try{main.sleep(100);}catch(Exception ex){}
          }
        }
      break;
      }
   }//if mode 0
   else{
     switch(keyCode){
       case java.awt.event.KeyEvent.VK_P:  //p      pause
         if(pause==true)pause=false;
         else if(pause==false)pause=true;
       break;
       case java.awt.event.KeyEvent.VK_O:  //o      onestep
	   //if(onestep==true)onestep=false;
	   //else if(onestep==false)onestep=true;
	 onestep=true;
       break;
     }
   }//if not mode 0

   //All modes...
   switch(keyCode){
     case java.awt.event.KeyEvent.VK_Q:    //q      debug key 1
       Qdown=true;
     break;
     case java.awt.event.KeyEvent.VK_W:    //w      debug key 2
       Wdown=true;
     break;
     case java.awt.event.KeyEvent.VK_E:    //e      change selected player
       currentplayer++;
       if(currentplayer>=maxnplayers)currentplayer=0;
     break;
     case java.awt.event.KeyEvent.VK_R:    //r      kill/restore selected player
       if(Qdown&&Wdown){
         if(stationstatus[currentplayer]==1)stationstatus[currentplayer]=0;
         else stationstatus[currentplayer]=1;
         if(winner!=-2)winner=-2;
       }
     break;
     case java.awt.event.KeyEvent.VK_T:    //t      change AI of selected player
       if(Qdown&&Wdown){
	 playerAI[currentplayer]++;
         if(playerAI[currentplayer]>nAI)playerAI[currentplayer]=0;
       }
     break;
   }
  }//method keypressed
                     
   // not alot to put in here, but needed by KeyListener 
   public void keyTyped(KeyEvent e) {
   }//method keytyped

   // ditto, we have nothing to do here also.
   public void keyReleased(KeyEvent e) {
     keydown=0;
     int keyCode = e.getKeyCode();
     switch(keyCode){
       case java.awt.event.KeyEvent.VK_Q:    //q
         Qdown=false;
       break;
       case java.awt.event.KeyEvent.VK_W:    //w
	 Wdown=false;
       break;
     }
   }
                     

    public void adjustmentValueChanged(AdjustmentEvent e){
    //the next if statement checks to see if the AdjustmentEvent
    //came from horiz
	if(e.getAdjustable()==horiz1 && e.getAdjustmentType()==java.awt.event.AdjustmentEvent.UNIT_DECREMENT && Angle[player]>=359 && listenmode==1){
          Angle[player]=0;
          horiz1.setValue(360-Angle[player]);
	}
	else if(e.getAdjustable()==horiz1 && e.getAdjustmentType()==java.awt.event.AdjustmentEvent.UNIT_INCREMENT && Angle[player]<=0 && listenmode==1){
          Angle[player]=359;
          horiz1.setValue(360-Angle[player]);
	}
    else if(e.getAdjustable()==horiz1 && listenmode==1){
    //sets the text in num to the value of horiz
       Angle[player]=360-horiz1.getValue();
       
       }
    else if(e.getAdjustable()==horiz2 && listenmode==1){
    //sets the text in num to the value of horiz
       
       Power[player]=horiz2.getValue();
       }
    }

    public void actionPerformed(ActionEvent e){
      String arg = e.getActionCommand();
      test=arg;
      if (e.getSource()==restartbutton) {
	if(menuoption==1){
          firstgo=0;
	  startnew=1;
          tornamentmode=0;
          game=0;
          pause=false;
          if(menutornamentmode==1){tornamentmode=1;game=0;}
        }
        else if(menuoption==2){
          firstgo=0;
	  startnew=1;
          tornamentmode=0;
          game=0;
          pause=false;
          if(menutornamentmode==1){tornamentmode=1;game=0;}
          
        }
      } 
      else if(e.getSource()==playerbutton){
	if(menuoption==1){
          menunplayers++;
          if(menunplayers>maxnplayers)menunplayers=2;
          playerbutton.setLabel(menunplayers+" players"); 
          if(menunhumanplayers>menunplayers)humanplayersbutton.setLabel(""+menunplayers+" human 0 cpu");
          else humanplayersbutton.setLabel(""+menunhumanplayers+" human "+(menunplayers-menunhumanplayers)+" cpu");
          if(menunplayers*menunplayersperteam>maxnplayers)stationbutton.setLabel((int)((double)maxnplayers/(double)menunplayers)+" stations/player");
          else stationbutton.setLabel(menunplayersperteam+" stations/player");
         
        }
        else if(menuoption==2){
	  menutornamentmode++;
          if(menutornamentmode>1)menutornamentmode=0;
	  if(menutornamentmode==0)playerbutton.setLabel("Single game");
	  else if(menutornamentmode==1)playerbutton.setLabel("Tornament");
          if(menutornamentmode==0)restartbutton.setLabel("Start Game");
          else if(menutornamentmode==1)restartbutton.setLabel("Start Tornament");
        }
      }
      else if(e.getSource()==humanplayersbutton){
        if(menuoption==1){
          menunhumanplayers++;
          if(menunhumanplayers>menunplayers)menunhumanplayers=0;
          humanplayersbutton.setLabel(""+(menunhumanplayers)+" human "+(menunplayers-menunhumanplayers)+" cpu");
        }
        else if(menuoption==2){
          menusize++;
          if(menusize>nsize+1)menusize=1;        
          if(menusize==1)humanplayersbutton.setLabel("micro stations");
          else if(menusize==2)humanplayersbutton.setLabel("tiny stations");
          else if(menusize==3)humanplayersbutton.setLabel("small stations");
          else if(menusize==4)humanplayersbutton.setLabel("medium stations");
          else if(menusize==5)humanplayersbutton.setLabel("large stations");
          else if(menusize==6)humanplayersbutton.setLabel("giant stations");
          else if(menusize==7)humanplayersbutton.setLabel("random size");
        }
      }
      else if(e.getSource()==stationbutton){
        if(menuoption==1){
          menunplayersperteam++;
          if(menunplayersperteam*menunplayers>maxnplayers)menunplayersperteam=1;
          stationbutton.setLabel(menunplayersperteam+" stations/player");
        }
        else if(menuoption==2){
          menunplanets++;
          if(menunplanets>maxnplanets+2)menunplanets=0;
          if(menunplanets<maxnplanets+1)stationbutton.setLabel(menunplanets+" planets");
          else if(menunplanets==maxnplanets+1)stationbutton.setLabel("random (max 8)");
          else if(menunplanets==maxnplanets+2)stationbutton.setLabel("random (max "+maxnplanets+")");
        }        
      }
      else if(e.getSource()==AIbutton){
        if(menuoption==1){
          menuAI++;
          if(menuAI>nAI)menuAI=1;        
          if(menuAI==1)AIbutton.setLabel("Cpu: randbot");
          else if(menuAI==2)AIbutton.setLabel("Cpu: aimbot");
          else if(menuAI==3)AIbutton.setLabel("Cpu: cleverbot");
          else if(menuAI==4)AIbutton.setLabel("Cpu: superbot");
          else if(menuAI==5)AIbutton.setLabel("Cpu: megabot");
          else if(menuAI==6)AIbutton.setLabel("Cpu: godbot");
        }
        else if(menuoption==2){
          menuscenairio++;
          if(menuscenairio>nscenairios+1)menuscenairio=1;
          if(menuscenairio==1)AIbutton.setLabel("planetary");
          else if(menuscenairio==2)AIbutton.setLabel("asteroids");
          else if(menuscenairio==3)AIbutton.setLabel("star system");
          else if(menuscenairio==4)AIbutton.setLabel("binary system");
          else if(menuscenairio==5)AIbutton.setLabel("jovian");
          else if(menuscenairio==6)AIbutton.setLabel("supergiant");
          else if(menuscenairio==7)AIbutton.setLabel("super binary");
          else if(menuscenairio==8)AIbutton.setLabel("uneven binary");
          else if(menuscenairio==9)AIbutton.setLabel("red giant");
          else if(menuscenairio==10)AIbutton.setLabel("star cluster");
          else if(menuscenairio==11)AIbutton.setLabel("mixture");
          else if(menuscenairio==12)AIbutton.setLabel("white dwarf");
          else if(menuscenairio==13)AIbutton.setLabel("wormhole");
          else if(menuscenairio==14)AIbutton.setLabel("dwarfs");
          else if(menuscenairio==15)AIbutton.setLabel("black hole");
          else if(menuscenairio==16)AIbutton.setLabel("black holes");
          else if(menuscenairio==17)AIbutton.setLabel("wormholes");
          else if(menuscenairio==18)AIbutton.setLabel("big wormhole");
          else if(menuscenairio==19)AIbutton.setLabel("white hole");
          else if(menuscenairio==20)AIbutton.setLabel("white holes");
          else if(menuscenairio==21)AIbutton.setLabel("hyperspace");
          else if(menuscenairio==22)AIbutton.setLabel("lucky dip");

        }

      }
      else if(e.getSource()==optionsbutton){
        menuoption++;
        if(menuoption>noptions)menuoption=1;        

        if(menuoption==1){
          if(menutornamentmode==0)restartbutton.setLabel("Start Game");
          if(menutornamentmode==1)restartbutton.setLabel("Start Tornament");
          playerbutton.setLabel(menunplayers+" players");
          if(menunhumanplayers>menunplayers)humanplayersbutton.setLabel(""+menunplayers+" human 0 cpu");
          else humanplayersbutton.setLabel(""+menunhumanplayers+" human "+(menunplayers-menunhumanplayers)+" cpu");
          if(menunplayers*menunplayersperteam>maxnplayers)stationbutton.setLabel((int)((double)maxnplayers/(double)menunplayers)+" stations/player");
          else stationbutton.setLabel(menunplayersperteam+" stations/player");
          if(menuAI==1)AIbutton.setLabel("Cpu: randbot");
          else if(menuAI==2)AIbutton.setLabel("Cpu: aimbot");
          else if(menuAI==3)AIbutton.setLabel("Cpu: cleverbot");
          else if(menuAI==4)AIbutton.setLabel("Cpu: superbot");
          else if(menuAI==5)AIbutton.setLabel("Cpu: megabot");
          else if(menuAI==6)AIbutton.setLabel("Cpu: godbot");
         

        }
        else if(menuoption==2){
	  //button 1
          if(menutornamentmode==0)restartbutton.setLabel("Start Game");
          else if(menutornamentmode==1)restartbutton.setLabel("Start Tornament");

	  //button 2
          if(menutornamentmode==0)playerbutton.setLabel("Single game");
          else if(menutornamentmode==1)playerbutton.setLabel("Tornament");

	  //button 3
          if(menusize==1)humanplayersbutton.setLabel("micro stations");
          if(menusize==2)humanplayersbutton.setLabel("tiny stations");
          else if(menusize==3)humanplayersbutton.setLabel("small stations");
          else if(menusize==4)humanplayersbutton.setLabel("medium stations");
          else if(menusize==5)humanplayersbutton.setLabel("large stations");
          else if(menusize==6)humanplayersbutton.setLabel("giant stations");
          else if(menusize==7)humanplayersbutton.setLabel("random size");
          
	  //button 4
          if(menunplanets<maxnplanets+1)stationbutton.setLabel(menunplanets+" planets");
          else if(menunplanets==maxnplanets+1)stationbutton.setLabel("random (max 8)");
          else if(menunplanets==maxnplanets+2)stationbutton.setLabel("random (max "+maxnplanets+")");
          
	  //button 5
          if(menuscenairio==1)AIbutton.setLabel("planetary");
          else if(menuscenairio==2)AIbutton.setLabel("asteroids");
          else if(menuscenairio==3)AIbutton.setLabel("star system");
          else if(menuscenairio==4)AIbutton.setLabel("binary system");
          else if(menuscenairio==5)AIbutton.setLabel("jovian");
          else if(menuscenairio==6)AIbutton.setLabel("supergiant");
          else if(menuscenairio==7)AIbutton.setLabel("super binary");
          else if(menuscenairio==8)AIbutton.setLabel("uneven binary");
          else if(menuscenairio==9)AIbutton.setLabel("red giant");
          else if(menuscenairio==10)AIbutton.setLabel("star cluster");
          else if(menuscenairio==11)AIbutton.setLabel("mixture");
          else if(menuscenairio==12)AIbutton.setLabel("white dwarf");
          else if(menuscenairio==13)AIbutton.setLabel("wormhole");
          else if(menuscenairio==14)AIbutton.setLabel("dwarfs");
          else if(menuscenairio==15)AIbutton.setLabel("black hole");
          else if(menuscenairio==16)AIbutton.setLabel("black holes");
          else if(menuscenairio==17)AIbutton.setLabel("wormholes");
          else if(menuscenairio==18)AIbutton.setLabel("big wormhole");
          else if(menuscenairio==19)AIbutton.setLabel("white hole");
          else if(menuscenairio==20)AIbutton.setLabel("white holes");
          else if(menuscenairio==21)AIbutton.setLabel("hyperspace");
          else if(menuscenairio==22)AIbutton.setLabel("lucky dip");

        }
        else if(menuoption==3){
          restartbutton.setLabel("");
          playerbutton.setLabel("");
          humanplayersbutton.setLabel("");
          stationbutton.setLabel("");
          AIbutton.setLabel("");
        }
      }

      else if(e.getSource()==hyperspacebutton&&listenmode==1){
	  if(stationhyperspace[player]==0)stationhyperspace[player]=1;
          else stationhyperspace[player]=0;
          try{main.sleep(100);}catch(Exception ex){}
      }
      else if(e.getSource()==firebutton&&listenmode==1){
        if(firstgo==0&&winner==-2){
          player++;
          while(player<nplayers&&stationstatus[player]!=1){player++;}


    	  if(player<nplayers) 
          {    horiz1.setValue(360-Angle[player]);
               horiz2.setValue(Power[player]);
	       try{main.sleep(100);}catch(Exception ex){}
          }
        }
      }
    }

    //the run method occurs while a Thread is running
    public void run(){
        double deltaX;
        double deltaY;
        double deltaX2;
        double deltaY2;
        double theta;
        double distance;
        double theta2;
        double sign;
        int planetnumber=0;
        double sign2;
        double Rsquared;
        double Accel;
        thetime = System.currentTimeMillis();
 	while(main!=null){
          if(running==false) { //The game is suspended (Netscape)
            try { main.sleep(500);
                }
            catch(Exception e) {}
          }
          else if(pause&&!onestep) { //The game is paused 
            try { repaint();
                  main.sleep(100);
                }
            catch(Exception e) {}
          }
          else { //Main game loop

            if(startnew==1){
              godraw=0;
              try{main.sleep(100);}catch(Exception ex){}
	      initilise();
              try{main.sleep(50);}catch(Exception ex){}
              godraw=1;
              startnew=0;
            }
            checkactive=0;
	    if(mode==1){       
	      for(int i=0;i<nplayers;i++){
                //check some bullets still active
		if(stationstatus[i]==3)checkactive=1;
		if(status[i]!=0){
		  checkactive=1;
                  if(status[i]==1){
                    for(int j=0;j<nplanets;j++){
		      sign=1.0f;
                      deltaX=(planetx[j]-x[i]);
                      deltaY=(planety[j]-y[i]);
                      theta=Math.atan(deltaY/deltaX);
       
                      if(deltaX<0.0)sign=-1.f;
		      Rsquared=(deltaX*deltaX+deltaY*deltaY);
                      
                      if(Rsquared<(planetradius[j]*planetradius[j])) {
                     
			if(planetimpact[j]==1)status[i]=2;        //explode
                        else if(planetimpact[j]==2) {             //vanish
                          status[i]=2;       
                          explosion[i]=30.0;                      //set explosion to 30 so all explosion effects 
			                                          //have been done, but trail is allowed to catch up.
                        }
                        else if(planetimpact[j]==3) {             //randomly teleport
			    x[i]=Math.random()*width;
			    y[i]=Math.random()*height;
                            teleports[i][numberofteleports[i]]=pathl[i];
                            //numberofteleports[i]++;
                            if(numberofteleports[i]>=maxteleports)status[i]=2;
                            else numberofteleports[i]++;
                        }
                        else if(planetimpact[j]==4) {             //randomly teleport to random planet

			  if(sign<0)theta2=theta+Math.PI;
                            else theta2=theta;
                         
                          planetnumber=(int)(nplanets*Math.random());

			  x[i]=planetx[planetnumber]+Math.cos(theta2)*(planetradius[planetnumber]+0.5);
			  y[i]=planety[planetnumber]+Math.sin(theta2)*(planetradius[planetnumber]+0.5);

                            teleports[i][numberofteleports[i]]=pathl[i];
                            //numberofteleports[i]++;
                            if(numberofteleports[i]>=maxteleports)status[i]=2;
                            else numberofteleports[i]++;
                        }
                        else if(planetimpact[j]<=0){       //teleport to planet -planetimpact[j]
  
			  if(sign<0)theta2=theta+Math.PI;
                            else theta2=theta;
                         
                          planetnumber=-planetimpact[j];

			  x[i]=planetx[planetnumber]+Math.cos(theta2)*(planetradius[planetnumber]+0.5);
			  y[i]=planety[planetnumber]+Math.sin(theta2)*(planetradius[planetnumber]+0.5);
			  //x[i]=planetx[0]+Math.cos(theta2)*(planetradius[-planetimpact[0]]+0.5);
			  //y[i]=planety[0]+Math.sin(theta2)*(planetradius[-planetimpact[0]]+0.5);
                           teleports[i][numberofteleports[i]]=pathl[i];
                           //numberofteleports[i]++;
                           if(numberofteleports[i]>=maxteleports)status[i]=2;
                           else numberofteleports[i]++;
                        } //if teleport to another planet
                      }
                      else {
                        Accel=sign*G*planetM[j]/Rsquared;
		        xvelocity[i]+=Math.cos(theta)*Accel*timestep;
                        yvelocity[i]+=Math.sin(theta)*Accel*timestep;
                      }
		    }//for allplanets
		  }//if status==1
		  }//if bullet active
	        }
              // check station bullet collision
              for(int i=0;i<nplayers;i++){        //loop i over bullets
		  for(int j=0;j<nplayers;j++){    //loop j over stations
		  if((stationstatus[j]==1)&&(x[i]-stationx[j])*(x[i]-stationx[j])+(y[i]-stationy[j])*(y[i]-stationy[j])<stationradius[j]*stationradius[j]){
		    if(status[i]==1){     //make sure exploding, but active bullets are counted only once.
		      if(stationteam[i]==stationteam[j]){
			if(i==j){stationsuicide[i]++;
                                 teamsuicide[stationteam[i]]++;
			        }
                        else    {stationowngoals[i]++;
                                 teamowngoals[stationteam[i]]++;
                                }
                        teamscore[stationteam[i]]--;
                      }
                      else {
                        stationkills[i]++;
                        teamkills[stationteam[i]]++;
                        teamscore[stationteam[i]]++;
                        if(stationteam[j]==topteam)stationstrategykills[i]++;     //strategy kill
                        if(stationteam[j]==bottomteam)stationopressionkills[i]++; //opression kill
                        if(stationteam[j]==winningteam)stationtacticskills[i]++;  //tactical kill
                        if(stationteam[j]==losingteam)stationbullykills[i]++;     //bully kill
                        distance=Math.sqrt((stationx[j]-stationx[i])*(stationx[j]-stationx[i])+(stationy[j]-stationy[i])*(stationy[j]-stationy[i]));
                        if(distance>width*longshotthreashhold)stationlongshotkills[i]++;
                        if(distance<width*closeshotthreashhold)stationcloseshotkills[i]++;
                      }
                      if(j==stationkilledby[i])stationvengencekills[i]++;  //vengence kill
                      
                    }
                    stationkilledby[j]=i;
		    status[i]=2;
                    stationstatus[j]=2;  
		  }
                }
              }
	      // update bullet's positions
              for(int i=0;i<nplayers;i++){
                if(status[i]==1){
                  x[i]=x[i]+xvelocity[i]*timestep;
                  y[i]=y[i]+yvelocity[i]*timestep;
                }
                // boundary conditions		                
                if(x[i]<left||x[i]>right||y[i]<top||y[i]>bottom){
                  
                  status[i]=0;
                }
              }
              step++;
	    //the next line tells the Applet to run the paint()
	    //method again
	      if(step>bulletlife*printevery){
		  for(int i=0;i<nplayers;i++)if(status[i]==1)status[i]=2;
	      }
	    if((checkactive==0)&&hyperspacing==0){
                if(scenairio==21){ //make hyperspace compulsory every go if scenairio=hyperspace
		    for(int i=0;i<nplayers;i++){
                       if(stationhyperspace[i]==0)stationhyperspace[i]=1;
                       else stationhyperspace[i]=0;
                    }
                }
		hyperspace();
                hyperspacing=1;
	    }
            else if(checkactive==0){        
              newturn();
              if(winner>-2 && firstgo!=0){ //first go - keep on playing!
		  initilise();try{main.sleep(2000);}catch(Exception ex){}
            }
            }
	    if(Math.IEEEremainder(step,printevery)==0.)
	      { //try{main.sleep(10);}catch(Exception e){}



              pathstep++;              
              for(int i=0;i<nplayers;i++){
		
		if(status[i]==1||status[i]==2){
                  if(pathl[i]<bulletlife+499){
                    pathx[i][pathl[i]]=(int)(conv*x[i]);
		    pathy[i][pathl[i]]=(int)(conv*y[i]);
                    pathl[i]++;
                  }

	          vvvoldx[i]=vvoldx[i];
                  vvvoldy[i]=vvoldy[i];
	          vvoldx[i]=voldx[i];
                  vvoldy[i]=voldy[i];
	          voldx[i]=oldx[i];
                  voldy[i]=oldy[i];
      	          oldx[i]=x[i];
                  oldy[i]=y[i];
                }
                if(status[i]==2){
                  explosion[i]=explosion[i]+0.1;
                  if(explosion[i]>100){explosion[i]=0;status[i]=0;}
                }//if bullet exploding

                if(stationstatus[i]==2){
	          stationexplosion[i]=stationexplosion[i]+0.15;
                  if(stationexplosion[i]>60){stationexplosion[i]=0;stationstatus[i]=0;}
                }//if station exploding
              }//for all players

              if(Math.IEEEremainder(step,printevery*showevery)==0.)
		{ 
                  try{
                      thetime+=40;
                      delaytime=thetime - System.currentTimeMillis();
		      painted=0;
                      waitingfor=0;
                  //repaint();
                  //while(painted==0){
                    repaint();
                    //main.sleep(30);
                    main.sleep(Math.max(15, delaytime));
                    thetime=System.currentTimeMillis();
                    //waitingfor++;
		    //}
                }
                catch(Exception e){
		    //waitingfor-=666;
                }
              onestep=false;  
              }

	      if(painted==0){
		//waitingfor++;
              //if(waitingfor>50)waitingfor=50;
              }
              else { 
		//waitingfor--;
              //if(waitingfor<7)waitingfor=7;
              }
	     
    
	    }
            
          }//if mode 1
          else if(mode==0)
	  { try
            {
              main.sleep(20);
	      counting++;
              if(allAI&&winner!=-2&&counting>500&&tornamentmode==1&&game!=0){startnew=1;} //autostart
              if(playerAI[player]>0&&player<nplayers){
                think();
	        player++;
              }
              if(player>=nplayers&&winner==-2){
                main.sleep(100);
	        listenmode=0;
                fire();
                for(int i=0;i<nplayers;i++){        
		  //stationcount[i]=0;
                  }
                //player=0;
              }//
              repaint();
	    }//try
	    catch(Exception e){}
          }//if mode 0
	}//main running loop
      }//while still going
    }//public void run

    public void think(){
      int currentAngle=0;
      int currentPower=0;
      int testAngle=0;
      int testPower=0;
      double deltaX;
      double deltaY;
      double theta;
      double sign;
      double test;
      double threshold;
      double closest;
      double testclosest;
      double distance=0;
      double distancemodifier=1.0;
      double mindistance=0;
       
      int accuracy;
        
      int target;
      int count;
      int count2;
      boolean unhappy;
      int wormhole=0;
      int times=1;
      int stepsize=20;
      int simsteps=400;

      //if no winner yet and station is active then think...
      if(stationstatus[player]==1&&winner==-2){ 

	//aiming should improve with turns...
	if(turn==1){
	  if(playerAI[player]==3){stepsize=40;simsteps=200;times=2;wormhole=0;}  
          if(playerAI[player]==4){stepsize=20;simsteps=400;times=5;wormhole=0;}  
          if(playerAI[player]==5){stepsize=5;simsteps=2000;times=20;wormhole=1;}
        }
	else if(turn==2){
	  if(playerAI[player]==3){stepsize=20;simsteps=400;times=3;wormhole=0;}  
          if(playerAI[player]==4){stepsize=10;simsteps=800;times=8;wormhole=0;}  
          if(playerAI[player]==5){stepsize=5;simsteps=2000;times=30;wormhole=1;}
        }
	else if(turn==3){
	  if(playerAI[player]==3){stepsize=20;simsteps=400;times=4;wormhole=0;}  
          if(playerAI[player]==4){stepsize=10;simsteps=800;times=13;wormhole=1;} 
          if(playerAI[player]==5){stepsize=5;simsteps=2000;times=40;wormhole=1;}
        }
	else if(turn<8){
	  if(playerAI[player]==3){stepsize=20;simsteps=400;times=5;wormhole=0;}  
          if(playerAI[player]==4){stepsize=10;simsteps=800;times=17;wormhole=1;} 
          if(playerAI[player]==5){stepsize=5;simsteps=2000;times=40;wormhole=1;}
        }
	else{
	  if(playerAI[player]==3){stepsize=10;simsteps=800;times=8;wormhole=0;}  
          if(playerAI[player]==4){stepsize=10;simsteps=800;times=25;wormhole=1;} 
          if(playerAI[player]==5){stepsize=5;simsteps=2000;times=50;wormhole=1;}
        }
        currentAngle=(int)(360*Math.random());
        currentPower=(int)(800*Math.random()+200);
	target=(int)(Math.random()*nplayers);
        count=1;
        if(playerAI[player]==4&&(Math.random()<0.5)){
	  unhappy=true;
          count2=1;
          mindistance=80.0;
          distance=0;
	  while(unhappy&&count2<100){
	    count=1;
	    while((stationteam[target]==stationteam[player]||stationstatus[target]==0)&&count<500){
              target=(int)(Math.random()*nplayers);
              count++;
            }
            distance=(stationx[target]-stationx[player])*(stationx[target]-stationx[player])+(stationy[target]-stationy[player])*(stationy[target]-stationy[player]);
            if(distance<mindistance*mindistance){unhappy=false;}
	    else {mindistance=mindistance*1.5;unhappy=true;target=player;}
            count2++;
	  }//while unhappy with target
	}//if AI=4
        if(playerAI[player]==5&&(Math.random()<0.85)){
	  unhappy=true;
          count2=1;
          mindistance=80.0;
          distance=0;
	  while(unhappy&&count2<100){
	    count=1;
            distancemodifier=1.0;
            //pick a random target
	    while((stationteam[target]==stationteam[player]||stationstatus[target]==0)&&count<500){
              target=(int)(Math.random()*nplayers);
              count++;
            }
            //Check for closest target
            distance=(stationx[target]-stationx[player])*(stationx[target]-stationx[player])+(stationy[target]-stationy[player])*(stationy[target]-stationy[player]);

            if(stationteam[target]==topteam)distancemodifier=1.5;
            else if(stationteam[target]==bottomteam)distancemodifier=0.5;
            else distancemodifier=1.0;

            if(stationteam[target]==winningteam)distancemodifier*=1.5;
            else if(stationteam[target]==losingteam)distancemodifier*=0.5;

            if(distance<mindistance*mindistance*distancemodifier){unhappy=false;}
	    else {mindistance=mindistance*1.5;unhappy=true;target=player;}

            //Check for not targeted by teammate
            if(Math.random()<0.85){
              for(int i=0;i<player;i++){
		if(target==stationtarget[i]&&stationteam[i]==stationteam[player]){
                  unhappy=true;
                  target=player;
                }
              }
	    }//if math.random...
            count2++;
	  }//while unhappy with target
	}//if AI=5
        else { //randomly assign target to player of different team
	  while((stationteam[target]==stationteam[player]||stationstatus[target]==0)&&count<500){
            target=(int)(Math.random()*nplayers);
            count++;
          }
	}

      if(playerAI[player]==1){  // randbot AI
        test=Math.random();
        if(test<0.18)stationhyperspace[player]=1;
      } 
      else if(playerAI[player]==2){  // aimbot AI     
        if(target!=player){ //unlikely but possible...
	  sign=1.0f;
          //target=0;
	  deltaX=stationx[target]-stationx[player];
	  deltaY=stationy[target]-stationy[player];
          if(deltaX<0.0)sign=-1.f;
          theta=-(int)(180*Math.atan(deltaY/deltaX)/(Math.PI))+180-(int)(sign*90);
          if(totalmass<20)accuracy=(int)((Math.random()*Math.random()+Math.random()*Math.random()+Math.random()*Math.random())*10);
          else if(totalmass<100)accuracy=(int)((Math.random()*Math.random()+Math.random()*Math.random()+Math.random())*60);
          else if(totalmass<300)accuracy=(int)((Math.random()*Math.random()+Math.random()+Math.random())*60);
          else accuracy=(int)((Math.random())*220);
          currentAngle=(int)Math.round(theta+accuracy*Math.random()-accuracy*Math.random());
          while(currentAngle>360)currentAngle=currentAngle-360;
	  while(currentAngle<0)currentAngle=currentAngle+360;

          if(totalmass<100) currentPower=(int)((3*Math.random()*Math.random()+Math.random())*200);
          else if(totalmass<300) currentPower=(int)((Math.random()+Math.random())*400);
          else currentPower=(int)(Math.random()*800);

          test=Math.random();
          if(test<0.14)stationhyperspace[player]=1;
        }
      } 
      if(playerAI[player]>=3){  // cleverbot,superbot,megabot AI
       
       testAngle=bestAIAngle[player][target]+(int)(6*Math.random()-6*Math.random());
       testPower=bestAIPower[player][target]+(int)(20*Math.random()-20*Math.random());
       
       while(testAngle>360)testAngle=testAngle-360;
       while(testAngle<0)testAngle=testAngle+360;
       if(testPower<0)testPower=0;
       if(testPower>800)testPower=800;

       
       closest=simulate(testAngle,testPower,target,stepsize,simsteps,wormhole);
       currentAngle=testAngle;
       currentPower=testPower;
       pathclosest=closest;

       for(count=1;count<times;count++){
         if(target!=player){ //unlikely but possible...

         try{main.sleep(5);}
	  catch(Exception e){}

         testAngle=bestAIAngle[player][target]+(int)(9*Math.random()-9*Math.random());
         testPower=bestAIPower[player][target]+(int)(90*Math.random()-90*Math.random());
       
         while(testAngle>360)testAngle=testAngle-360;
         while(testAngle<0)testAngle=testAngle+360;
         if(testPower<0)testPower=0;
         if(testPower>800)testPower=800;

       
         testclosest=simulate(testAngle,testPower,target,stepsize,simsteps,wormhole);
         if(testclosest<closest){
           pathclosest2=testclosest;
	   currentPower=testPower;
	   currentAngle=testAngle;
           closest=testclosest;
           
         }
       
         sign=1.0f;
         deltaX=stationx[target]-stationx[player];
         deltaY=stationy[target]-stationy[player];
         if(deltaX<0.0)sign=-1.f;
         theta=-(int)(180*Math.atan(deltaY/deltaX)/(Math.PI))+180-(int)(sign*90);
         if(closest<2000&&(Math.random()<0.5))theta=currentAngle;
       
           if(totalmass<20)accuracy=(int)((Math.random()*Math.random()+Math.random()*Math.random()+Math.random()*Math.random())*10);
           else if(totalmass<100)accuracy=(int)((Math.random()*Math.random()+Math.random()*Math.random()+Math.random())*60);
           else if(totalmass<200)accuracy=(int)((Math.random()*Math.random()+Math.random()+Math.random())*70);
           else accuracy=(int)((Math.random())*220);
           testAngle=(int)Math.round(theta+accuracy*Math.random()-accuracy*Math.random());
           while(testAngle>360)testAngle=testAngle-360;
	   while(testAngle<0)testAngle=testAngle+360;

           testPower=(int)(Math.random()*800);

         }
       
         testclosest=simulate(testAngle,testPower,target,stepsize,simsteps,wormhole);
         
         if(testclosest<closest){
           pathclosest2=testclosest;
	   currentPower=testPower;
	   currentAngle=testAngle;
           closest=testclosest;
           
         }
       }
       
       test=Math.random();
       if(playerAI[player]>=4){
	 threshold=0.08;

         if(closest<50)threshold=0.03;
         else if(closest<200)threshold=0.04;
         else if(closest<400)threshold=0.05;
         else if(closest<800)threshold=0.06;
         else if(closest<2000)threshold=0.12;
         else threshold=0.16;

         if(totalmass<100)threshold=threshold*0.5;                            //asteroids
         else if(totalmass>100&&totalmass<=300)threshold=threshold*1.0;       //1-4 planets
         else if(totalmass>300&&totalmass<=600)threshold=threshold*1.2;       //star
         else if(totalmass>600&&totalmass<=2000)threshold=threshold*1.5;      //several stars
         else if(totalmass>2000)threshold=threshold*2.0;                      //supergiants  holes etc.

         if(test<threshold)stationhyperspace[player]=1;
       }
       else if(test<0.11)stationhyperspace[player]=1;

      }//if cleverbot+ AI
      Angle[player]=currentAngle;
      Power[player]=currentPower;
      bestAIAngle[player][target]=currentAngle;
      bestAIPower[player][target]=currentPower;
      stationtarget[player]=target;
      }
    }//method think

    public double simulate(int angle, int power, int target, int stepsize, int SIMsteps, int wormhole){
	//from fire
      int SIMstatus=1;
      double SIMxvelocity=(power/1000.0+minpower)*maxpower*Math.sin((angle/180.0)*Math.PI);
      double SIMyvelocity=(power/1000.0+minpower)*maxpower*Math.cos((angle/180.0)*Math.PI);
      double SIMx=stationx[player]+(stationradius[player]+initialdistance)*Math.sin((angle/180.0)*Math.PI);
      double SIMy=stationy[player]+(stationradius[player]+initialdistance)*Math.cos((angle/180.0)*Math.PI);
      double SIMoldx=SIMx;
      double SIMoldy=SIMy;
      double SIMclosest;

      // from main loop

      int SIMcheckactive=1;
      int SIMplanetnumber;
      double SIMsign=1.0;
      double SIMdeltaX;
      double SIMdeltaY;
      double SIMtheta;
      double SIMtheta2;
      double SIMRsquared;
      double SIMAccel;
      double SIMtimestep=stepsize*timestep;
      double SIMdistance;
      int SIMstep=0;
      highestA=0;
      SIMclosest=width*width;

      // start of SIM loop
 	while(SIMcheckactive==1){
          for(int j=0;j<nplanets;j++){
	    SIMsign=1.0f;
            SIMdeltaX=(planetx[j]-SIMx);
            SIMdeltaY=(planety[j]-SIMy);
            SIMtheta=Math.atan(SIMdeltaY/SIMdeltaX);
       
            if(SIMdeltaX<0.0)SIMsign=-1.f;
	    SIMRsquared=(SIMdeltaX*SIMdeltaX+SIMdeltaY*SIMdeltaY);
                      
            if(SIMRsquared<(planetradius[j]*planetradius[j])){
              if(planetimpact[j]<=0&&wormhole==1){       //teleport to planet -planetimpact[j]
  
		  if(SIMsign<0)SIMtheta2=SIMtheta+Math.PI;
                            else SIMtheta2=SIMtheta;
                         
                  SIMplanetnumber=-planetimpact[j];

		  SIMx=planetx[SIMplanetnumber]+Math.cos(SIMtheta2)*(planetradius[SIMplanetnumber]+0.5);
		  SIMy=planety[SIMplanetnumber]+Math.sin(SIMtheta2)*(planetradius[SIMplanetnumber]+0.5);
			                          
              } //if teleport to another planet
	      else{
                SIMcheckactive=0;
              }
	    }
            else {
              SIMAccel=SIMsign*G*planetM[j]/SIMRsquared;
              if(SIMAccel>0.3)SIMcheckactive=0;
              if(SIMAccel>highestA)highestA=SIMAccel;
	      SIMxvelocity+=Math.cos(SIMtheta)*SIMAccel*SIMtimestep;
              SIMyvelocity+=Math.sin(SIMtheta)*SIMAccel*SIMtimestep;
            }
	  }
		       
	  // update SIM bullet's positions
                             
          SIMx=SIMx+SIMxvelocity*SIMtimestep;
          SIMy=SIMy+SIMyvelocity*SIMtimestep;

          SIMdeltaX=(stationx[target]-SIMx);
          SIMdeltaY=(stationy[target]-SIMy);
          SIMdistance=SIMdeltaX*SIMdeltaX+SIMdeltaY*SIMdeltaY;
          if(SIMdistance<SIMclosest)SIMclosest=SIMdistance;
                
          // boundary conditions		                
          if(SIMx<left||SIMx>right||SIMy<top||SIMy>bottom)SIMcheckactive=0;
              

	  //   pathx[SIMstep]=(int)SIMx;
          //   pathy[SIMstep]=(int)SIMy;
          //   pathl=SIMstep;

          SIMstep++;

          if(SIMstep>=SIMsteps)SIMcheckactive=0;
	           
	    SIMoldx=SIMx;
            SIMoldy=SIMy;
	 
	  
        }//while still going
	return SIMclosest;
    }

//-------------------------------------------------
//-------------------------------------------------
//-------------------------------------------------

    private void fire(){
      
	for(int i=0;i<nplayers;i++){
          if(stationstatus[i]==1&&stationhyperspace[i]==0){
            stationshots[i]++;
            teamshots[stationteam[i]]++;
            stationtotalpower[i]+=Power[i];
	    LastAngle[i]=Angle[i];
	    LastPower[i]=Power[i];
            status[i]=1;
	    xvelocity[i]=(Power[i]/1000.0+minpower)*maxpower*Math.sin((Angle[i]/180.0)*Math.PI);
            yvelocity[i]=(Power[i]/1000.0+minpower)*maxpower*Math.cos((Angle[i]/180.0)*Math.PI);
            x[i]=stationx[i]+(stationradius[i]+initialdistance)*Math.sin((Angle[i]/180.0)*Math.PI);
            y[i]=stationy[i]+(stationradius[i]+initialdistance)*Math.cos((Angle[i]/180.0)*Math.PI); 
            oldx[i]=x[i];
            oldy[i]=y[i];
            voldx[i]=x[i];
            voldy[i]=y[i];
            vvoldx[i]=x[i];
            vvoldy[i]=y[i];
            vvvoldx[i]=x[i];
            vvvoldy[i]=y[i];
            pathl[i]=0;
	    numberofteleports[i]=0;
          }
          else{
            status[i]=0;
          }
        }
	mode=1;
        wipe=1;         //not needed now tripple buffering!
        starfield=1;    //not needed now tripple buffering!
	//paint(bufferg); //not needed now tripple buffering!
        //repaint((long)0.0001);
        painted=0;
        pause=false;
        while(painted==0){
          repaint(); 
          try{main.sleep(200);}
	  catch(Exception e){} 
        }
        wipe=0;
        starfield=0;
        

	//spathl=0;
    } //method fire

    public void hyperspace(){
      double minplayerdistance=130.;
      int check=0;
      int count=0;
      for(int i=0;i<nplayers;i++){
        if(stationstatus[i]==1&&stationhyperspace[i]==1){
	  check=0;
          oldstationx[i]=stationx[i];
          oldstationy[i]=stationy[i];
          stationstatus[i]=3;
          pathl[i]=0;
	  numberofteleports[i]=0;
	  while(check==0){
	    check=1;
            stationx[i]=(int)((0.9*Math.random())*width+0.05*width);
            stationy[i]=(int)((0.9*Math.random())*height+0.05*height);	
            //station station check
	      for(int j=0;j<nplayers;j++){
	        if(j!=i&&(stationx[i]-stationx[j])*(stationx[i]-stationx[j])+(stationy[i]-stationy[j])*(stationy[i]-stationy[j])<minplayerdistance*minplayerdistance){
                   
                   if(check==1)minplayerdistance=minplayerdistance-5;
                   check=0;
                   if(minplayerdistance<48.0)minplayerdistance=48.0;
                   //poo=minplayerdistance; //for debugging can be removed
                   //testint=-count;        //for debugging can be removed
                }
	      }
            
            //station planet check
	      for(int j=0;j<nplanets;j++){
	        if(((stationx[i]-planetx[j])*(stationx[i]-planetx[j])+(stationy[i]-planety[j])*(stationy[i]-planety[j]))<((stationradius[i]+planetradius[j])*(stationradius[i]+planetradius[j])))check=0;
	      }
	      count++;
		if(count>5000)check=1;
                if(Math.IEEEremainder(count,500)==0.)
                {
		  try{main.sleep(50);}
		  catch(Exception e){}
	        }
          }//while check=0
          stationhyperspace[i]=0;
          stationstatus[i]=3;
          stationcount[i]=1;
	}//if hyperspacing
      }//for all stations

    }

    public void newturn(){
	int tempscore=0;
        hyperspacing=0;
        //checkactive=1;   // so that when we return to main loop things proceed
	player=0;
        step=0;
        int moststationsalive=0;
        int leaststationsalive=maxnplayers;
        int teammoststationsalive=-1;
        int teamleaststationsalive=-1;
        pathstep=0;
        counting=0;
	timesdrawn=0;
        wipe=1;
	starfield=1;
    
        turn++;

        for(int i=0;i<nplayers;i++) if(stationstatus[i]==3)stationstatus[i]=1;

        while(stationstatus[player]!=1&&player<nplayers){player++;}

        for(int i=0;i<nplayers;i++){
          if(stationstatus[i]==1)stationturns[i]++;
          if(stationstatus[i]==1)teamturns[stationteam[i]]++;
          x[i]=0.0;
          y[i]=0.0;
          oldy[i]=0.0;
          oldx[i]=0.0;
          voldy[i]=0.0;
          voldx[i]=0.0;
          vvoldy[i]=0.0;
          vvoldx[i]=0.0;
          vvvoldy[i]=0.0;
          vvvoldx[i]=0.0;
          status[i]=0;
          explosion[i]=0.0;
          stationexplosion[i]=0;
          stationcount[i]=0;
          stationhyperspace[i]=0;
          lastdisplayed[i]=0;
        }

	//while(playerAI[player]>0&&player<nplayers){
	    //Angle[player]=(int)(360*Math.random());
	    //Power[player]=(int)(80*Math.random()+20);
	//   think();
	//     player++;
	//    }

        if(player<nplayers){
	    //horiz1.addAdjustmentListener(this);
	    //horiz2.addAdjustmentListener(this);
	    //firebutton.addActionListener(this);
	    //hyperspacebutton.addActionListener(this);
	    listenmode=1;
          horiz1.setValue(360-Angle[player]);
          horiz2.setValue(Power[player]);
        }

        //check for winning condition and establish if a single team is winning this game so far.
	    
            int nteamsalive=0;
            for(int j=0;j<nteams;j++){
              int nalive=0;
              for(int i=0;i<nplayers;i++){
		if(stationstatus[i]==1&&stationteam[i]==j){
                  nalive++;
                  winner=i;
                  if(nalive>moststationsalive){
		    teammoststationsalive=stationteam[i];
                    moststationsalive=nalive;
                  }
                  else if(nalive==moststationsalive){
		    teammoststationsalive=-1;
                  }// establish team in the lead this game

                }
              }

              if(nalive<leaststationsalive&&nalive>0){
		teamleaststationsalive=j;
                leaststationsalive=nalive;
              }
              else if(nalive==leaststationsalive){
		teamleaststationsalive=-1;
              }// establish losing team                  

  	      if(nalive>0){nteamsalive++;}  
            }
	    if(nteamsalive==0){winner=-1;}      //all dead - no winner
            else if(nteamsalive>1)winner=-2;  //game not over yet
            
            winningteam=teammoststationsalive;
            losingteam=teamleaststationsalive;

            //variable 'winner' marks a player on winning team, not team number. 
            if(winner>-1){
	      for(int i=0;i<nplayers;i++){
		if(stationstatus[i]==1){
		  stationsurvive[i]++;
		  teamsurvive[stationteam[i]]++;
                  teamscore[stationteam[i]]++;
                }
	      }
              teamscore[stationteam[winner]]++;
              teamwins[stationteam[winner]]++;

            }

            //bubble sort leaderboard
            for(int i=0;i<nteams;i++){
	      for(int j=1;j<nteams;j++){
		    if((teamscore[leaderboard[j]]>teamscore[leaderboard[j-1]])||(teamscore[leaderboard[j]]==teamscore[leaderboard[j-1]]&&Math.round(100*teamkills[leaderboard[j]]/(teamshots[leaderboard[j]]+0.000001))>Math.round(100*teamkills[leaderboard[j-1]]/(teamshots[leaderboard[j-1]]+0.000001)))){
                      tempscore=leaderboard[j];
                      leaderboard[j]=leaderboard[j-1];
                      leaderboard[j-1]=tempscore;
                    }
	      }
	    }

            //decide if there is a definate top team
            if((teamscore[leaderboard[0]]>teamscore[leaderboard[1]])||(teamscore[leaderboard[0]]==teamscore[leaderboard[1]]&&Math.round(100*teamkills[leaderboard[0]]/(teamshots[leaderboard[0]]+0.000001))>Math.round(100*teamkills[leaderboard[1]]/(teamshots[leaderboard[1]]+0.000001)))){
		topteam=leaderboard[0];
            }
            else topteam=-1;

            //decide if there is a definate bottom team
            if((teamscore[leaderboard[nteams-1]]<teamscore[leaderboard[nteams-2]])||(teamscore[leaderboard[nteams-1]]==teamscore[leaderboard[nteams-2]]&&Math.round(100*teamkills[leaderboard[nteams-1]]/(teamshots[leaderboard[nteams-1]]+0.000001))<Math.round(100*teamkills[leaderboard[nteams-2]]/(teamshots[leaderboard[nteams-2]]+0.000001)))){
		bottomteam=leaderboard[nteams-1];
            }
            else bottomteam=-1;

	//AWARDS -----------------------------------------------------
        int awardcount;
        int highestcount;
         
        //bloodlustaward
        highestcount=2;
        bloodlustaward=-1;
        for(int i=0;i<nteams;i++){
	  awardcount=0;
          for(int j=0;j<nplayers;j++){
	    if(stationteam[j]==i){
		awardcount+=stationkills[j];
		awardcount+=stationowngoals[j];
            }
          }
          if(awardcount>highestcount){
            highestcount=awardcount;
            bloodlustaward=i;
          }
          else if(awardcount==highestcount) bloodlustaward=-1;
        }

        //oppressionaward
        highestcount=3;
        oppressionaward=-1;
        for(int i=0;i<nteams;i++){
	  awardcount=0;
          for(int j=0;j<nplayers;j++){
	    if(stationteam[j]==i){
		awardcount+=stationopressionkills[j];
            }
          }
          if(awardcount>highestcount){
            highestcount=awardcount;
            oppressionaward=i;
          }
          else if(awardcount==highestcount) oppressionaward=-1;
        }

	try{main.sleep(100);}catch(Exception ex){}
        mode=0;
        //if(player>=nplayers&&winner==-2){
	//  listenmode=0;
        //  fire(); 
        //}//all players are cpu or dead and game is still on
    }

    //the paint() method paints different things to the Applet
    public void paint(Graphics g){
	//the next line runs the update method
	update(g);
    }
    public void update(Graphics g){
      long starttime = System.currentTimeMillis();
      double temp;
      double theta;
      double r;
      double x1,y1;
      double x2,y2;
      double x0,y0;
      double loc,x3,y3,stddev;
      int nebuleastars, nebulea;
      //int actingIradius=10;

      double fx,fy,deltaX,deltaY;
      double pointerheight=.06;
      double pointerwidth=5;
      double minpointerheight=100;
      double modifier;
      int triangleX[]=new int[3];
      int triangleY[]=new int[3];

      Random rand=new Random(seed);
      double explosionR;
      Dimension d=getSize();
	
      String str;
      String str2;
      String str3;
      String s1,s2,s3;
      if(godraw==1){
	if(!pause||onestep){
	bufferg.setColor(Color.black);

	//	starfield=1;
	//      timesdrawn=1;

        buffer2g.setColor(Color.black);
        buffer2g.fillRect(0,0,d.width,d.height);

	if(wipe==1&&timesdrawn<2)bufferg.fillRect(0,0,d.width,d.height);

      	buffer2g.setFont(bigfont);
	if(timesdrawn<2){

	//Draw starfield
        if(starfield==1){
	  if(scenairio<21){
	    //ambient starfield
            for(int i=0;i<nstars;i++){
              bufferg.setColor(starcolour[i].darker());
	      bufferg.fillOval(starx[i],stary[i],(int)(starr[i]),(int)(starr[i]));
            }
	    //Draw nebulea
            nebulea=0;
            for(int j=0;j<nebulea;j++){
              x1=width*rand.nextDouble();
              x2=width*rand.nextDouble();
              y1=height*rand.nextDouble();
              y2=height*rand.nextDouble();
              stddev=0.4*height*rand.nextDouble();
              nebuleastars=1000;

              for(int i=0;i<nebuleastars;i++){
                loc=rand.nextGaussian()+0.5;
                x3=x1+loc*(x2-x1);
                y3=y1+loc*(y2-y1);
                bufferg.setColor(starcolour[i].darker());
	        bufferg.fillOval((int)(x3+rand.nextGaussian()*stddev),(int)(y3+rand.nextGaussian()*stddev),(int)(0.5*starr[i]),(int)(0.5*starr[i]));
              }
            }
	  }
         


//*********************************************        
//Draw star halos ...
	  
for(int i=0;i<nplanets;i++){
    if(planetshading[i]==2){
       for(int j=0;j<nangles;j++){
	   theta=2*Math.PI*j/nangles;
           r=planetradius[i]+planethalo[i]*1.5*Math.sqrt(planetradius[i]*1.20)+planethalo[i]*1.5*Math.sqrt(planetradius[i]*0.9*rand.nextDouble());
           xset[j]=(int)(conv*(r*Math.cos(theta)+planetx[i]));
           yset[j]=(int)(conv*(r*Math.sin(theta)+planety[i]));
       }

       bufferg.setColor(((planetcolour[i].darker()).darker()).darker().darker().darker());
       bufferg.fillPolygon(xset,yset,nangles);             
    }
}

for(int i=0;i<nplanets;i++){
    if(planetshading[i]==2){
       for(int j=0;j<nangles;j++){
	   theta=2*Math.PI*j/nangles;
r=planetradius[i]+planethalo[i]*1.5*Math.sqrt(planetradius[i]*0.22)+planethalo[i]*1.5*Math.sqrt(planetradius[i]*0.6*rand.nextDouble());
//           r=planetradius[i]*1.05+planetradius[i]*0.1*rand.nextDouble();
           xset[j]=(int)(conv*(r*Math.cos(theta)+planetx[i]));
           yset[j]=(int)(conv*(r*Math.sin(theta)+planety[i]));
       }

       bufferg.setColor(((planetcolour[i].darker()).darker()).darker().darker());
       bufferg.fillPolygon(xset,yset,nangles);             
    }
}

for(int i=0;i<nplanets;i++){
    if(planetshading[i]==2){
       for(int j=0;j<nangles;j++){
	   theta=2*Math.PI*j/nangles;
r=planetradius[i]-planethalo[i]*Math.sqrt(planetradius[i]*0.02)+planethalo[i]*1.5*Math.sqrt(planetradius[i]*0.7*rand.nextDouble());
//           r=planetradius[i]*1.05+planetradius[i]*0.1*rand.nextDouble();
           xset[j]=(int)(conv*(r*Math.cos(theta)+planetx[i]));
           yset[j]=(int)(conv*(r*Math.sin(theta)+planety[i]));
       }

       bufferg.setColor(((planetcolour[i].darker()).darker()).darker());
       bufferg.fillPolygon(xset,yset,nangles);             
    }
}

//Draw wormhole halos ...
for(int i=0;i<nplanets;i++){
    if(planetshading[i]==3){
             bufferg.setColor(((planetcolour[i].darker()).darker()).darker());
             bufferg.fillOval((int)(planetx[i]*conv)-planetIradius[i]-(int)(planetradius[i]*conv),(int)(planety[i]*conv)-planetIradius[i]-(int)(planetradius[i]*conv),(planetIradius[i]+(int)(planetradius[i]*conv))*2,(planetIradius[i]+(int)(planetradius[i]*conv))*2);
    }
}
for(int i=0;i<nplanets;i++){
    if(planetshading[i]==3){
             bufferg.setColor((planetcolour[i].darker()));
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(planetIradius[i]*0.5+planetradius[i]*conv),(int)(planety[i]*conv)-(int)(planetIradius[i]*0.5+planetradius[i]*conv),(int)(planetIradius[i]*0.5+planetradius[i]*conv)*2,(int)(planetIradius[i]*0.5+planetradius[i]*conv)*2);
    }
}
for(int i=0;i<nplanets;i++){
    if(planetshading[i]==3){
             bufferg.setColor(planetcolour[i]);
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(planetIradius[i]*0.2+planetradius[i]*conv),(int)(planety[i]*conv)-(int)(planetIradius[i]*0.2+planetradius[i]*conv),2*(int)(planetIradius[i]*0.2+planetradius[i]*conv),2*(int)(planetIradius[i]*0.2+planetradius[i]*conv));
    }
}
for(int i=0;i<nplanets;i++){
    if(planetshading[i]==3){
             bufferg.setColor(planetcolour[i].brighter());
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(planetIradius[i]*0.1+planetradius[i]*conv),(int)(planety[i]*conv)-(int)(planetIradius[i]*0.1+planetradius[i]*conv),2*(int)(planetIradius[i]*0.1+planetradius[i]*conv),2*(int)(planetIradius[i]*0.1+planetradius[i]*conv));
    }
}

	 for(int i=0;i<nplanets;i++){
	   if(planetshading[i]<2){ //plane circle
	     bufferg.setColor(planetcolour[i]);
             bufferg.fillOval((int)(planetx[i]*conv)-planetIradius[i],(int)(planety[i]*conv)-planetIradius[i],planetIradius[i]*2,planetIradius[i]*2);
           }
           if(planetshading[i]==1){ //planet
             bufferg.setColor(planetcolour[i].darker());
             bufferg.fillArc((int)(planetx[i]*conv)-planetIradius[i],
                   (int)(planety[i]*conv)-planetIradius[i],
                   planetIradius[i]*2,
                   planetIradius[i]*2,90,180);
             bufferg.setColor(planetcolour[i]);

             bufferg.fillArc((int)(planetx[i]*conv-planetIradius[i]/2),
                   (int)(planety[i]*conv)-planetIradius[i],
                   planetIradius[i],
                   planetIradius[i]*2,90,180);
           }
           if(planetshading[i]==2){ //star
             bufferg.setColor(planetcolour[i].darker());
             bufferg.fillOval((int)(planetx[i]*conv)-planetIradius[i],(int)(planety[i]*conv)-planetIradius[i],planetIradius[i]*2,planetIradius[i]*2);
             bufferg.setColor(planetcolour[i]);
             bufferg.fillOval((int)(planetx[i]*conv)-planetIradius[i]+(int)(3.5*conv),(int)(planety[i]*conv)-planetIradius[i]+(int)(3.5*conv),planetIradius[i]*2-2*(int)(3.5*conv),planetIradius[i]*2-2*(int)(3.5*conv));
             bufferg.setColor(planetcolour[i].brighter());
             bufferg.fillOval((int)(planetx[i]*conv)-planetIradius[i]+(int)(10*conv),(int)(planety[i]*conv)-planetIradius[i]+(int)(10*conv),planetIradius[i]*2-2*(int)(10*conv),planetIradius[i]*2-2*(int)(10*conv));
           }
           if(planetshading[i]==3){ //wormhole
             bufferg.setColor(planetcolour[i].darker());
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(conv*planetradius[i]),(int)(planety[i]*conv)-(int)(planetradius[i]*conv),(int)(conv*planetradius[i])*2,(int)(conv*planetradius[i])*2);
             bufferg.setColor((planetcolour[i].darker()).darker());
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(conv*planetradius[i])+1,(int)(planety[i]*conv)-(int)(conv*planetradius[i])+1,(int)(conv*planetradius[i])*2-2,(int)(conv*planetradius[i])*2-2);
             bufferg.setColor(Color.black);
             bufferg.fillOval((int)(planetx[i]*conv)-(int)(conv*planetradius[i])+2,(int)(planety[i]*conv)-(int)(conv*planetradius[i])+2,(int)(conv*planetradius[i])*2-4,(int)(conv*planetradius[i])*2-4);
             
           }
	
	}
        }
	}
timesdrawn++;
	//*****************************
	//Draw bullets onto background
          for(int i=0;i<nplayers;i++){
            if(status[i]>0){
	    bufferg.setColor(stationcolour[i].darker());

            //bufferg.fillOval((int)(vvvoldx[i]*conv)-Iradius[i],(int)(vvvoldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            //bufferg.fillOval((int)(vvoldx[i]*conv)-Iradius[i],(int)(vvoldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            //bufferg.fillOval((int)(voldx[i]*conv)-Iradius[i],(int)(voldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            //bufferg.fillOval((int)(oldx[i]*conv)-Iradius[i],(int)(oldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            //bufferg.fillOval((int)(x[i]*conv)-Iradius[i],(int)(y[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            for(int j=lastdisplayed[i];j<pathl[i];j++){        
              bufferg.fillOval(pathx[i][j]-Iradius[i],pathy[i][j]-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }
            if(pathl[i]-1>0)lastdisplayed[i]=pathl[i]-1;
	    }
          }

	//*****************************
        }//if not paused

        //copy background onto forground
        buffer2g.drawImage(buffer,0,0,this);

	//*****************************
	//Draw stations
	for(int i=0;i<nplayers;i++){
	  if(stationstatus[i]==1){
            buffer2g.setColor(stationcolour[i]);
            buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i],(int)(stationy[i]*conv)-stationIradius[i],stationIradius[i]*2,stationIradius[i]*2);
            buffer2g.setColor(stationcolour[i].darker());
            
            buffer2g.fillArc((int)(stationx[i]*conv)-stationIradius[i],
                   (int)(stationy[i]*conv)-stationIradius[i],
                   stationIradius[i]*2,
                   stationIradius[i]*2,90,180);
            buffer2g.setColor(stationcolour[i]);

            buffer2g.fillArc((int)(stationx[i]*conv-stationIradius[i]/2),
                   (int)(stationy[i]*conv)-stationIradius[i],
                   stationIradius[i],
                   stationIradius[i]*2,90,180);
            buffer2g.setColor(stationcolour[i].darker());
            buffer2g.drawArc((int)((stationx[i]*conv)-stationIradius[i]+1),
		            (int)(stationy[i]*conv)-1,
               		    2*stationIradius[i]-2,
			    stationIradius[i]/3,0,-180);                
            buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i]/10,(int)(stationy[i]*conv)-(int)(stationIradius[i]*0.8),(int)(stationIradius[i]*0.8),(int)(stationIradius[i]*0.8));

          }
          else if(stationstatus[i]==3){
	    
	      if(stationcount[i]<2) buffer2g.setColor(stationcolour[i].brighter());
              else if(stationcount[i]<3) buffer2g.setColor(Color.white);
              else if(stationcount[i]<13) buffer2g.setColor(new Color(255-20*stationcount[i],255-20*stationcount[i],255-20*stationcount[i]));

              if(stationcount[i]<13) buffer2g.fillOval((int)(oldstationx[i]*conv)-stationIradius[i],(int)(oldstationy[i]*conv)-stationIradius[i],stationIradius[i]*2,stationIradius[i]*2);

              if (stationcount[i]>12&&stationcount[i]<24) buffer2g.setColor(new Color(20*(stationcount[i]-12),20*(stationcount[i]-12),20*(stationcount[i]-12)));
              else if (stationcount[i]==24) buffer2g.setColor(Color.white);
              else if (stationcount[i]==25) buffer2g.setColor(stationcolour[i].brighter());

              if(stationcount[i]>12) buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i],(int)(stationy[i]*conv)-stationIradius[i],stationIradius[i]*2,stationIradius[i]*2);
   
              if(Math.random()<0.5)stationcount[i]++;   //random bit adds 'flicker' to hyperspace effect

              if(stationcount[i]>25){
		  stationcount[i]=0;
                  stationstatus[i]=1;
              }//if finished hyperspacing
	    
	  }//if hyperspacing
        }


	//*****************************
	//Draw bullets onto forground
        for(int i=0;i<nplayers;i++){
           if(status[i]==1||status[i]==2){
	       //buffer2g.setColor(stationcolour[i]);
	       //buffer2g.fillOval((int)(vvvoldx[i]*conv)-Iradius[i],(int)(vvvoldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//               buffer2g.setColor(stationcolour[i]);
//               buffer2g.fillOval((int)(vvoldx[i]*conv)-Iradius[i],(int)(vvoldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//               buffer2g.fillOval((int)(0.5*(vvoldx[i]+voldx[i])*conv)-Iradius[i],(int)(0.5*(voldy[i]+vvoldy[i])*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//               buffer2g.setColor(stationcolour[i].brighter());

//               buffer2g.fillOval((int)(voldx[i]*conv)-Iradius[i],(int)(voldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//               buffer2g.fillOval((int)(0.5*(voldx[i]+oldx[i])*conv)-Iradius[i],(int)(0.5*(oldy[i]+voldy[i])*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//               buffer2g.setColor(stationcolour[i].brighter().brighter());
//               buffer2g.fillOval((int)(oldx[i]*conv)-Iradius[i],(int)(oldy[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
//  buffer2g.fillOval((int)(0.5*(x[i]+oldx[i])*conv)-Iradius[i],(int)(0.5*(y[i]+oldy[i])*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);


            buffer2g.setColor(stationcolour[i]);
            for(int j=Math.max(0,pathl[i]-50);j<pathl[i]-25;j++){        
              buffer2g.fillOval(pathx[i][j]-Iradius[i],pathy[i][j]-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }
            buffer2g.setColor(stationcolour[i].brighter());
            for(int j=Math.max(0,pathl[i]-25);j<pathl[i]-10;j++){        
              buffer2g.fillOval(pathx[i][j]-Iradius[i],pathy[i][j]-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }
            buffer2g.setColor(stationcolour[i].brighter().brighter());
            for(int j=Math.max(0,pathl[i]-10);j<pathl[i];j++){        
              buffer2g.fillOval(pathx[i][j]-Iradius[i],pathy[i][j]-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }
            if(status[i]==1){
		// buffer2g.setFont(smallfont);
              buffer2g.setColor(Color.white);
              buffer2g.fillOval((int)(x[i]*conv)-Iradius[i],(int)(y[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }
            else {
              buffer2g.setColor(stationcolour[i].darker());
              buffer2g.fillOval((int)(x[i]*conv)-Iradius[i],(int)(y[i]*conv)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
            }

//******** OUT OF BOUNDS BULLET *********
//
	   if(status[i]==1){
             buffer2g.setFont(smallfont);
             if(y[i]<topgapoverconv){
	       if(x[i]<width){
	         fy=(topgapoverconv-y[i])/(-top+topgapoverconv);
                 fx=-x[i]/(-left);
	         if(fx<fy){
                 
                   fx=(fy*(-left)+x[i])/(width+fy*(-left)+fy*(right-width));

                 x0=fx*width;
                 y0=topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 if(deltaX>0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));
                 

                   buffer2g.setColor(Color.green);
                   if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("UP 2:"+fx+","+fy,(int)(screenwidth/2),280);

                   //buffer2g.setColor(Color.white);
                   
                   //buffer2g.fillOval((int)(fx*width*conv)-Iradius[i],(int)(topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
                 else {
		   
                   fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 x0=0;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 //if(deltaY<0)theta=theta+Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));
                 
                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("LEFT UP:"+fx+","+fy,(int)(screenwidth/2),280);
//buffer2g.drawString("LEFT UP:"+fx+","+fy,30,300);
//                 buffer2g.setColor(Color.white);
//                 buffer2g.fillOval(0,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);

                 }
               }
               else{
                 fy=(topgapoverconv-y[i])/(-top+topgapoverconv);
                 fx=(x[i]-width)/(right-width);
	         if(fx<fy){
                   fx=(fy*(-left)+x[i])/(width+fy*(-left)+fy*(right-width));

                 x0=fx*width;
                 y0=topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 
                 if(deltaX>0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));


		 //buffer2g.drawString("UP 1:"+fx+","+fy,30,300);

                   buffer2g.setColor(Color.green);
                   if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("UP 1:"+fx+","+fy,(int)(screenwidth/2),280);
                   //buffer2g.setColor(Color.white);
                   
                   //buffer2g.fillOval((int)(fx*width*conv)-Iradius[i],(int)(topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
                 else {
                   fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 x0=width;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX)-Math.PI;
		 //if(deltaY<0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));

                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("RIGHT UP:"+fx+","+fy,(int)(screenwidth/2),280);
		 //buffer2g.drawString("RIGHT UP:"+fx+","+fy,10,300);
		 //buffer2g.setColor(Color.white);
		 //buffer2g.fillOval(screenwidth-2,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
               }
             }
             else if(y[i]>(height-(topgap)/conv)){
               if(x[i]<width){
	         fy=(y[i]-(height-bottomgapoverconv))/(bottom-height-topgapoverconv);
                 fx=-x[i]/(-left);
	         if(fx<fy){
                 
                   fx=(fy*(-left)+x[i])/(width+fy*(-left)+fy*(right-width));
                 x0=fx*width;
                 y0=height-bottomgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 
                 if(deltaX>0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));


                 //  buffer2g.drawString("DOWN 2:"+fx+","+fy,30,300);

                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("DOWN 2:"+fx+","+fy,(int)(screenwidth/2),280);
		 // buffer2g.setColor(Color.white);
                   
		 // buffer2g.fillOval((int)(fx*width*conv)-Iradius[i],(int)(screenheight-bottomgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
                 else {
                   
                  
                   fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 x0=0;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 //if(deltaY<0)theta=theta+Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));
                   buffer2g.setColor(Color.green);
                   if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("LEFT DOWN:"+fx+","+fy,(int)(screenwidth/2),280);
//buffer2g.drawString("LEFT DOWN:"+fx+","+fy,30,300);
                   //buffer2g.setColor(Color.white);
                   //buffer2g.fillOval(0,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);

                 }
               }
               else{
                 fy=(y[i]-(height-bottomgapoverconv))/(bottom-height-topgapoverconv);
                 
                 fx=(x[i]-width)/(right-width);
	         if(fx<fy){
                   fx=(fy*(-left)+x[i])/(width+fy*(-left)+fy*(right-width));

                 x0=fx*width;
                 y0=height-bottomgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 
                 if(deltaX>0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));

		 //buffer2g.drawString("DOWN 1:"+fx+","+fy,30,300);
                   buffer2g.setColor(Color.green);
                   if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("DOWN 1:"+fx+","+fy,(int)(screenwidth/2),280);
                   //buffer2g.setColor(Color.white);
                   //buffer2g.fillOval((int)(fx*width*conv)-Iradius[i],(int)(screenheight-bottomgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
                 else {
		 
                   fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 x0=width;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX)-Math.PI;
		 //if(deltaY<0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));
                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("RIGHT DOWN:"+fx+","+fy,(int)(screenwidth/2),280);
                 //buffer2g.drawString("RIGHT DOWN:"+fx+","+fy,30,300);
                 //buffer2g.setColor(Color.white);
                 //buffer2g.fillOval(screenwidth-2,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 }
               }

             }
             else{
	       if(x[i]<0){
             	 fx=-x[i]/(-left);   
                 fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("LEFT:"+fx+","+fy,(int)(screenwidth/2),280);
                 //buffer2g.drawString("LEFT:"+fx+","+fy,30,300);
                 //buffer2g.setColor(Color.white);
                 //buffer2g.fillOval(0,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);
                 x0=0;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX);
		 //if(deltaY<0)theta=theta+Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));
                 
               }
               else if(x[i]>width){
             	 fx=(x[i]-width)/(right-width);   
                 fy=(fx*(-top+topgapoverconv)+y[i]-topgapoverconv)/(height-topgapoverconv-bottomgapoverconv+fx*(-top+topgapoverconv)+fx*((bottom-height)+bottomgapoverconv));

                 x0=width;
                 y0=fy*(height-bottomgapoverconv-topgapoverconv)+topgapoverconv;
                 deltaX=x[i]-x0;
                 deltaY=y[i]-y0;
	         theta=Math.atan(deltaY/deltaX)-Math.PI;
		 //if(deltaY<0)theta=theta-Math.PI;
                 modifier=Math.sqrt(deltaX*deltaX+deltaY*deltaY)+minpointerheight;
                 x1=modifier*pointerheight*Math.cos(theta);
                 y1=modifier*pointerheight*Math.sin(theta);
                 x2=pointerwidth*Math.sin(-theta);
                 y2=pointerwidth*Math.cos(-theta);
                

                 triangleX[0]=(int)(x0*conv);
                 triangleX[1]=(int)((x0+x1+x2)*conv);
                 triangleX[2]=(int)((x0+x1-x2)*conv);
                 triangleY[0]=(int)(y0*conv);
                 triangleY[1]=(int)((y0+y1+y2)*conv);
                 triangleY[2]=(int)((y0+y1-y2)*conv);
                 buffer2g.setColor(stationcolour[i]);
                 
                 buffer2g.fillPolygon(triangleX,triangleY,3);
		 //buffer2g.setColor(Color.white);        
                 //buffer2g.drawLine((int)(x0*conv),(int)(y0*conv),(int)((x0+x1)*conv),(int)((y0+y1)*conv));
                 //buffer2g.drawLine((int)((x0+x1+x2)*conv),(int)((y0+y1+y2)*conv),(int)((x0+x1-x2)*conv),(int)((y0+y1-y2)*conv));

                 buffer2g.setColor(Color.green);
                 if(Qdown&&Wdown&&currentplayer==i)buffer2g.drawString("RIGHT:"+fx+","+fy,(int)(screenwidth/2),280);
                 //buffer2g.drawString("RIGHT:"+fx+","+fy,30,300);
                 //buffer2g.setColor(Color.white);
                 
                 //buffer2g.fillOval(screenwidth-2,(int)(fy*(height*conv-bottomgap-topgap)+topgap)-Iradius[i],Iradius[i]*2,Iradius[i]*2);

	       }
             }
	   }//if not exploding
	  }//if status=1 or 2
        }
	   //draw station explosions
        for(int i=0;i<nplayers;i++){
          if(stationstatus[i]==2){
	    if(stationexplosion[i]<=5){
            buffer2g.setColor(stationcolour[i]);
            buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i],(int)(stationy[i]*conv)-stationIradius[i],stationIradius[i]*2,stationIradius[i]*2);
            buffer2g.setColor(stationcolour[i].darker());
            
            buffer2g.fillArc((int)(stationx[i]*conv)-stationIradius[i],
                   (int)(stationy[i]*conv)-stationIradius[i],
                   stationIradius[i]*2,
                   stationIradius[i]*2,90,180);
            buffer2g.setColor(stationcolour[i]);

            buffer2g.fillArc((int)(stationx[i]*conv-stationIradius[i]/2),
                   (int)(stationy[i]*conv)-stationIradius[i],
                   stationIradius[i],
                   stationIradius[i]*2,90,180);
            buffer2g.setColor(stationcolour[i].darker());
            buffer2g.drawArc((int)((stationx[i]*conv)-stationIradius[i]+1),
		            (int)(stationy[i]*conv)-1,
               		    2*stationIradius[i]-2,
			    stationIradius[i]/3,0,-180);                
            buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i]/10,(int)(stationy[i]*conv)-(int)(stationIradius[i]*0.8),(int)(stationIradius[i]*0.8),(int)(stationIradius[i]*0.8));
	    }
	    else if(stationexplosion[i]<35&&stationexplosion[i]>5){
              explosionR=((stationexplosion[i]-5)-(stationexplosion[i]-5)*(stationexplosion[i]-5)/40.0);
              //buffer2g.setColor(new Color((int)(255-2*(stationexplosion[i]-5)),(int)(255-4*(stationexplosion[i]-5)),0));
              //buffer2g.fillOval((int)(stationx[i]*conv)-stationIradius[i]*(explosionR),(int)(stationy[i]*conv)-stationIradius[i]*(explosionR),stationIradius[i]*2*(explosionR),stationIradius[i]*2*(explosionR));
	      
              //red
              buffer2g.setColor(new Color((int)(245-1*(stationexplosion[i]-5)),(int)(125-2*(stationexplosion[i]-5)),0));
              buffer2g.fillOval((int)(stationx[i]*conv-stationIradius[i]*explosionR),(int)(stationy[i]*conv-stationIradius[i]*explosionR),(int)(stationIradius[i]*2*explosionR),(int)(stationIradius[i]*2*explosionR));
	      
              //orange
              buffer2g.setColor(new Color((int)(255-2*(stationexplosion[i]-5)),(int)(255-4*(stationexplosion[i]-5)),0));
              buffer2g.fillOval((int)(stationx[i]*conv-0.9*stationIradius[i]*explosionR),(int)(stationy[i]*conv-0.9*stationIradius[i]*explosionR),(int)(stationIradius[i]*1.8*explosionR),(int)(stationIradius[i]*1.8*explosionR)); 
	      
              //darkyellow
              buffer2g.setColor(new Color((int)(255-0.9*(stationexplosion[i]-5)),(int)(255-2.2*(stationexplosion[i]-5)),(int)(125-2*(stationexplosion[i]-5))));
              buffer2g.fillOval((int)(stationx[i]*conv-0.8*stationIradius[i]*explosionR),(int)(stationy[i]*conv-0.8*stationIradius[i]*explosionR),(int)(stationIradius[i]*1.6*explosionR),(int)(stationIradius[i]*1.6*explosionR)); 
	      
              //yellow
              buffer2g.setColor(new Color((int)(255.0-0.6*(stationexplosion[i]-5)),(int)(255-1.2*(stationexplosion[i]-5)),(int)(255-4*(stationexplosion[i]-5))));
              buffer2g.fillOval((int)(stationx[i]*conv-0.6*stationIradius[i]*explosionR),(int)(stationy[i]*conv-0.6*stationIradius[i]*explosionR),(int)(stationIradius[i]*1.2*explosionR),(int)(stationIradius[i]*1.2*explosionR));

              //bright yellow
              buffer2g.setColor(new Color((int)(255.0-0.4*(stationexplosion[i]-5)),(int)(255-0.8*(stationexplosion[i]-5)),(int)(255-2*(stationexplosion[i]-5))));
              buffer2g.fillOval((int)(stationx[i]*conv-0.3*stationIradius[i]*explosionR),(int)(stationy[i]*conv-0.3*stationIradius[i]*explosionR),(int)(stationIradius[i]*0.6*explosionR),(int)(stationIradius[i]*0.6*explosionR));
	      }
	    //stationexplosion[i]++;
             
	    //if(stationexplosion[i]>60){stationexplosion[i]=0;stationstatus[i]=0;}
          }

        }
        for(int i=0;i<nplayers;i++){
           if(status[i]==2){
	     if(explosion[i]<=10){
	       explosionR=3*(explosion[i]-explosion[i]*explosion[i]/20.0);      
               //buffer2g.setColor(new Color(255-10*(int)explosion[i],0,0));
               //buffer2g.fillOval((int)(oldx[i]*conv)-Iradius[i]*(explosionR),(int)(oldy[i]*conv)-Iradius[i]*(explosionR),Iradius[i]*2*(explosionR),Iradius[i]*2*(explosionR));

               buffer2g.setColor((new Color(255-10*(int)explosion[i],0,0)).darker());
               buffer2g.fillOval((int)(oldx[i]*conv-Iradius[i]*explosionR),(int)(oldy[i]*conv-Iradius[i]*explosionR),(int)(Iradius[i]*2*explosionR),(int)(Iradius[i]*2*explosionR));
               buffer2g.setColor(new Color(255-10*(int)explosion[i],0,0));
               buffer2g.fillOval((int)(oldx[i]*conv)-(int)(0.8*Iradius[i]*explosionR),(int)(oldy[i]*conv)-(int)(0.8*Iradius[i]*explosionR),(int)(Iradius[i]*1.6*explosionR),(int)(Iradius[i]*1.6*explosionR));
               buffer2g.setColor((new Color(255-10*(int)explosion[i],124-5*(int)explosion[i],0)));
               buffer2g.fillOval((int)(oldx[i]*conv)-(int)(0.6*Iradius[i]*explosionR),(int)(oldy[i]*conv)-(int)(0.6*Iradius[i]*explosionR),(int)(Iradius[i]*1.2*explosionR),(int)(Iradius[i]*1.2*explosionR));
               buffer2g.setColor((new Color(255-10*(int)explosion[i],255-10*(int)explosion[i],0)));
               buffer2g.fillOval((int)(oldx[i]*conv)-(int)(0.4*Iradius[i]*(explosionR)),(int)(oldy[i]*conv)-(int)(0.4*Iradius[i]*explosionR),(int)(Iradius[i]*0.8*explosionR),(int)(Iradius[i]*0.8*explosionR));
             }
	     //             explosion[i]=explosion[i]+0.7;
             //             if(explosion[i]>100){explosion[i]=0;status[i]=0;}
           }
        }

	//  if(mode==0){
	   if(firstgo!=0){

//*********************************************
// Draw the loading message
      
        str = "D E A T H   S T A R   B A T T L E S";
        buffer2g.setFont(bigfont);
        buffer2g.setColor(Color.white);
        buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str)) / 2, bigfm.getAscent()+10+topgap);
        buffer2g.setFont(smallfont);

        //str = "conv"+conv+" width"+width+" height"+height+" screenwidth"+screenwidth+" screenheight"+screenheight;
        //if(conv!=1.0)buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - smallfm.getHeight()) / 4) + smallfm.getAscent());

        str = "V1.6.4 (c) 2001 - Ian Bolland       email : ian@bolland.org       www.bolland.org";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - smallfm.getHeight()) / 6) + smallfm.getAscent()+topgap);

        str = "You control different 'death star' battle stations, fighting each other in an epic space battle.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 16*smallfm.getHeight())) + smallfm.getAscent());

        str = "Take it in turns to fire at each other by adjusting the angle and power using the sliders below.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 14*smallfm.getHeight())) + smallfm.getAscent());

        str = "When you are happy with the angle and power, press the end turn button to let the next player go.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 12*smallfm.getHeight())) + smallfm.getAscent());

        str = "All player's shots will then be fired. All shots are effected by the gravity of the stars and planets.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 10*smallfm.getHeight())) + smallfm.getAscent());

        str = "If things get sticky, the hyperspace button will transport you to a random location.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 8*smallfm.getHeight())) + smallfm.getAscent());

        str = "The last surviving team wins, press the start button at any time to start again.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 6*smallfm.getHeight())) + smallfm.getAscent());

        str = "Set the various options by clicking the buttons above and then press the start button to begin.";
        buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, ((getSize().height - 4*smallfm.getHeight())) + smallfm.getAscent());

           }
	   if(mode==0&&firstgo==0){    //else 
           buffer2g.setFont(bigfont);
  	     if(winner==-1&&tornamentmode==0){
               buffer2g.setColor(Color.black);
               buffer2g.fillRect(0,0,d.width,d.height);
               buffer2g.setColor(Color.white);
               str = "N o b o d y    W i n s ! ";
               buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, ((getSize().height - bigfm.getHeight()) / 2) + bigfm.getAscent());
             }
             else if(winner>-1&&tornamentmode==0){
	       if(nplayersperteam==1){
                 buffer2g.setColor(Color.black);
                 buffer2g.fillRect(0,0,d.width,d.height);
                 buffer2g.setColor(stationcolour[winner]);
                 str ="P l a y e r   "+(winner+1)+"   w i n s !";
                 buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, ((getSize().height - bigfm.getHeight()) / 2) + bigfm.getAscent());
               }
               else{
	         if(nplayersperteam>1){
                   buffer2g.setColor(Color.black);
                   buffer2g.fillRect(0,0,d.width,d.height);
                   buffer2g.setColor(stationcolour[winner]);
                   str ="T e a m   "+(stationteam[winner]+1)+"   w i n s !";
                   buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, ((getSize().height - bigfm.getHeight()) / 2) + bigfm.getAscent());
                 }
	       }
             }
  	     if(winner!=-2&&tornamentmode==1&&game!=0){
	       if(winner==-1){
                 buffer2g.setColor(Color.black);
                 buffer2g.fillRect(0,0,d.width,d.height);
                 buffer2g.setColor(Color.white);
                 str = "Nobody wins game "+game;
                 buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, bigfm.getAscent()+10+topgap);
               }
	       else if(winner>-1&&nplayersperteam==1){
                 buffer2g.setColor(Color.black);
                 buffer2g.fillRect(0,0,d.width,d.height);
                 buffer2g.setColor(stationcolour[winner]);
                 str ="Player "+(winner+1)+" wins game "+game;
                 buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, bigfm.getAscent()+10+topgap);
                 
               }
               else{
	         if(winner>-1&&nplayersperteam>1){
                   buffer2g.setColor(Color.black);
                   buffer2g.fillRect(0,0,d.width,d.height);
                   buffer2g.setColor(stationcolour[winner]);
                   str ="Team "+(stationteam[winner]+1)+" wins game "+game;
                   buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, bigfm.getAscent()+10+topgap);
                 }
	       }
	       // Display leaderboard.
               buffer2g.setFont(smallfont);
               if(nplayersperteam>1)str2="Team ";
               else str2="Player ";
               str3="1st";
               for(int i=0;i<nteams;i++){
		//"1st   Team 4    58%   accuracy   12 wins   18 kills   12 survivors     TOTAL SCORE = 33"                  
                   if(i>0&&(teamscore[leaderboard[i]]!=teamscore[leaderboard[i-1]]||Math.round(100*teamkills[leaderboard[i]]/(teamshots[leaderboard[i]]+0.000001))!=Math.round(100*teamkills[leaderboard[i-1]]/(teamshots[leaderboard[i-1]]+0.000001)))){
                     if(i==1)str3="2nd";
                     else if(i==2)str3="3rd";
                     else if(i>2)str3=(i+1)+"th";
                   }
                   if(teamkills[leaderboard[i]]==1)s1="";
                   else s1="s";
                   if(teamwins[leaderboard[i]]==1)s2="";
                   else s2="s";
                   if(teamsurvive[leaderboard[i]]==1)s3="";
                   else s3="s";
                   buffer2g.setColor(teamcolour[leaderboard[i]]);
		   str=str3+"   "+str2+(leaderboard[i]+1)+"     "+Math.round(100*teamkills[leaderboard[i]]/(teamshots[leaderboard[i]]+0.000001))+"% accuracy   "+teamwins[leaderboard[i]]+" win"+s2+"   "+teamkills[leaderboard[i]]+" kill"+s1+"   "+teamsurvive[leaderboard[i]]+" survivor"+s3+"     TOTAL SCORE = "+teamscore[leaderboard[i]];
                   if(nteams>4)buffer2g.drawString(str, (screenwidth - smallfm.stringWidth(str))/2, bigfm.getAscent()+80+(int)(i*((screenheight-120-bigfm.getAscent())/nteams))  );
                   else buffer2g.drawString(str, (screenwidth - smallfm.stringWidth(str))/2, bigfm.getAscent()+100+(int)(i*((screenheight-220-bigfm.getAscent())/nteams))  );
                   buffer2g.setColor(Color.white);
                   str="Click to continue with tornament or select start to begin a new tornament";
                   buffer2g.drawString(str, (getSize().width - smallfm.stringWidth(str))/2, screenheight-10-bottomgap );
               } //for all teams
             }//if in tornament mode and displaying leaderboard
             else if(winner==-2&&stationcount[player]==0){
               
               if(player<nplayers){
  		 if(nplayersperteam==1)str ="P l a y e r   "+(player+1);
                 else str ="T e a m   "+(stationteam[player]+1)+"    S t a t i o n   "+(stationnumber[player]+1);
                 buffer2g.setColor(Color.black);
                 buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2+3, bigfm.getAscent()+10+topgap+3);
buffer2g.setColor(stationcolour[player]);
                 buffer2g.drawString(str, (getSize().width - bigfm.stringWidth(str))/2, bigfm.getAscent()+10+topgap);
	       }
               if(playerAI[player]>0&&player<nplayers){
                 
                 str="Thinking...";
                 buffer2g.setColor(Color.black);
                 buffer2g.drawString(str,(getSize().width - bigfm.stringWidth(str))/2+3,screenheight-10-bottomgap+3);
                 buffer2g.setColor(Color.white);
                 buffer2g.drawString(str,(getSize().width - bigfm.stringWidth(str))/2,screenheight-10-bottomgap);
               }
               else if(playerAI[player]==0&&player<nplayers){
                 
                 if(stationhyperspace[player]==1){
                   buffer2g.drawRect((int)(conv*stationx[player])-stationboxradius[player],
                            (int)(conv*stationy[player])-stationboxradius[player],
                            2*stationboxradius[player],2*stationboxradius[player]);
                   
                   str="Hyperspacing...";
                   buffer2g.setColor(Color.black);
                   buffer2g.drawString(str,(getSize().width - bigfm.stringWidth(str))/2+3,screenheight-10-bottomgap+3);
                   buffer2g.setColor(Color.white);
                   buffer2g.drawString(str,(getSize().width - bigfm.stringWidth(str))/2,screenheight-10-bottomgap);
                 }//if hyperspacing
                 else{
		     //buffer2g.setColor((stationcolour[player].darker()).darker());
                   buffer2g.setColor((stationcolour[player].darker()));

                   if(numberofteleports[player]==0)buffer2g.drawPolyline(pathx[player],pathy[player],pathl[player]);
                   else{
                     buffer2g.drawPolyline(pathx[player],pathy[player],teleports[player][0]);
                     for(int i=1;i<numberofteleports[player];i++){
                       for(int j=0;j<(teleports[player][i]-teleports[player][i-1]);j++){
		         spathx[j]=pathx[player][j+teleports[player][i-1]];
		         spathy[j]=pathy[player][j+teleports[player][i-1]];
                       } 
                       buffer2g.drawPolyline(spathx,spathy,teleports[player][i]-teleports[player][i-1]);
                     }
                     for(int j=0;j<(pathl[player]-teleports[player][numberofteleports[player]-1]);j++){
		       spathx[j]=pathx[player][j+teleports[player][numberofteleports[player]-1]];
		       spathy[j]=pathy[player][j+teleports[player][numberofteleports[player]-1]];
                     } 

                     buffer2g.drawPolyline(spathx,spathy,pathl[player]-teleports[player][numberofteleports[player]-1]);
                   }
                   buffer2g.setColor(Color.white);

                   
		     
                     buffer2g.drawOval((int)(conv*stationx[player])-stationboxradius[player],
                            (int)(conv*stationy[player])-stationboxradius[player],
                            2*stationboxradius[player],2*stationboxradius[player]);

                     buffer2g.drawLine((int)(conv*stationx[player]),(int)(conv*stationy[player]),
                       (int)((conv*stationx[player])+(((stationarrowminradius[player])+(stationboxradius[player]-stationarrowminradius[player])*(Power[player]-1)/800))*Math.sin((Angle[player]/180.0)*Math.PI)),
                       (int)((conv*stationy[player])+(((stationarrowminradius[player])+(stationboxradius[player]-stationarrowminradius[player])*(Power[player]-1)/800))*Math.cos((Angle[player]/180.0)*Math.PI)) 
                                      );

//                     buffer2g.drawRect((int)(conv*stationx[player])-3*stationIradius[player],
//  		                (int)(conv*stationy[player])-3*stationIradius[player],
//                              6*stationIradius[player],6*stationIradius[player]);
//                     buffer2g.drawLine((int)(conv*stationx[player]),(int)(conv*stationy[player]),
//                       (int)((conv*stationx[player])+(((1.05*conv*stationradius[player])+(1.9*conv*stationradius[player])*Power[player]/1000))*Math.sin((Angle[player]/180.0)*Math.PI)),
//                       (int)((conv*stationy[player])+(((1.05*conv*stationradius[player])+(1.9*conv*stationradius[player])*Power[player]/1000))*Math.cos((Angle[player]/180.0)*Math.PI)) 
//                                  );
                   
                   str ="Power:"+nf.format(Power[player]/10.0+(int)(1000*minpower-1)/10.0);
                   if(Power[player]>800)str ="Power:100";

                   buffer2g.setColor(Color.black);
                   buffer2g.drawString(str, (getSize().width - bigfm.stringWidth("Power:10.0"))+3, screenheight-10-bottomgap+3);

                   if(Power[player]==LastPower[player])buffer2g.setColor(Color.yellow);
                   else buffer2g.setColor(Color.white);

                   buffer2g.drawString(str, (getSize().width - bigfm.stringWidth("Power:10.0")), screenheight-10-bottomgap);
                   
                   buffer2g.setColor(Color.black);
                   if(Angle[player]>180)buffer2g.drawString("Angle:"+(540-Angle[player]),10+3,screenheight-10-bottomgap+3);
                   else buffer2g.drawString("Angle:"+(180-Angle[player]),10+3,screenheight-10-bottomgap+3);

                   if(Angle[player]==LastAngle[player])buffer2g.setColor(Color.yellow);
                   else buffer2g.setColor(Color.white);

                   if(Angle[player]>180)buffer2g.drawString("Angle:"+(540-Angle[player]),10,screenheight-10-bottomgap);
                   else buffer2g.drawString("Angle:"+(180-Angle[player]),10,screenheight-10-bottomgap);
	         }//else (not hyperspacing) 
               }//if human player then display aiming info
	     }//if no winner yet
	   }//if mode 0 and not first go


	   //Debug mode
	   if(Qdown&&Wdown){
             buffer2g.setFont(smallfont);
             buffer2g.setColor(Color.blue);
             for(int i=0;i<nplanets;i++){
	       buffer2g.fillOval((int)(planetx[i]*conv)-2,(int)(planety[i]*conv)-2,2*2,2*2);
               buffer2g.drawString(""+planetM[i],(int)(planetx[i]*conv),(int)(planety[i]*conv));
             }

             buffer2g.setColor(new Color(255,0,255));
             buffer2g.fillOval((int)(stationx[currentplayer]*conv)-4,(int)(stationy[currentplayer]*conv)-4,4*2,4*2);
             buffer2g.drawString("Player "+currentplayer,(int)(stationx[currentplayer]*conv),(int)(stationy[currentplayer]*conv));
             buffer2g.drawOval((int)(x[currentplayer]*conv)-6,(int)(y[currentplayer]*conv)-6,6*2,6*2);
             buffer2g.drawLine((int)(screenwidth/4),(int)(screenheight/2),(int)(x[currentplayer]*conv),(int)(y[currentplayer]*conv));
             buffer2g.drawLine((int)(3*screenwidth/4),(int)(screenheight/2),(int)(x[currentplayer]*conv),(int)(y[currentplayer]*conv));
             
             buffer2g.setColor(Color.green);
             //if(Math.IEEEremainder(step,printevery*2)==0.)buffer2g.setColor(Color.blue);

             if(focused)buffer2g.drawString("Focused"+" firstgo:"+firstgo,20,80);
             else buffer2g.drawString("Not Focused"+" firstgo:"+firstgo,20,80);
             buffer2g.drawString("Screen:"+screenwidth+"x"+screenheight+" conv:"+conv,20,100);
             buffer2g.drawString("Game:"+width+"x"+height,20,120);
             buffer2g.drawString("Mode:"+mode+" timestep:"+timestep+" Checkactive:"+checkactive,20,140);
             buffer2g.drawString("Game:"+game+" Turn:"+turn+" Hyperspacing:"+hyperspacing,20,160);
             buffer2g.drawString("Step:"+step+","+pathstep+"/"+bulletlife*printevery+" prt,shw every:"+printevery+","+showevery,20,180);
             buffer2g.drawString("Winner:"+winner+" Stations:"+nplayers+" Teams:"+nteams,20,200);
             buffer2g.drawString("Planets:"+nplanets+" totalmass:"+totalmass,20,220);
             buffer2g.drawString("Scenario:"+scenairio+" tornamentmode:"+tornamentmode,20,240);
             if(pause&&onestep)buffer2g.drawString("Paused STEPPING keydown("+keydown+")",20,260);
             else if(pause&&(!onestep))buffer2g.drawString("Paused   keydown("+keydown+")",20,260);
             else buffer2g.drawString("Not Paused   keydown("+keydown+")",20,260);

             buffer2g.drawString("MIN top h,w"+toplayout.minimumLayoutSize(northpanel).height+","+toplayout.minimumLayoutSize(northpanel).width+" bottom h,w"+bottomlayout.minimumLayoutSize(northpanel).height+","+bottomlayout.minimumLayoutSize(northpanel).width,20,280);
             buffer2g.drawString("PREF top h,w"+toplayout.preferredLayoutSize(northpanel).height+","+toplayout.preferredLayoutSize(northpanel).width+" bottom h,w"+bottomlayout.preferredLayoutSize(northpanel).height+","+bottomlayout.preferredLayoutSize(northpanel).width,20,300);
             buffer2g.drawString("topgap"+topgap+" bottomgap"+bottomgap,20,320);
             buffer2g.drawString("bottomgapoverconv"+bottomgapoverconv,20,340);
             buffer2g.drawString("topteam:"+topteam+" bottomteam:"+bottomteam,20,360);
             buffer2g.drawString("winningteam:"+winningteam+" losingteam:"+losingteam,20,380);
             buffer2g.drawString("freearea:"+percentfree,20,400);
             buffer2g.drawString("topgapoverconv"+topgapoverconv,20,420);
             buffer2g.drawString("oppression:"+oppressionaward+"bloodlust:"+bloodlustaward,20,440);
             buffer2g.drawString("Drawtime:"+drawtime+" delaytime"+delaytime,20,460);

	     //---------------------
             
             buffer2g.drawString("Station:"+currentplayer+" team:"+stationteam[currentplayer]+" AI:"+playerAI[currentplayer],(int)(screenwidth/2),80);
             buffer2g.drawString("Status:"+stationstatus[currentplayer]+" shotstatus:"+status[currentplayer],(int)(screenwidth/2),100);
             buffer2g.drawString("Hyperspace:"+stationhyperspace[currentplayer]+" count:"+stationcount[currentplayer],(int)(screenwidth/2),120);
             buffer2g.drawString("Explosion:"+stationexplosion[currentplayer]+" Shot Exp:"+explosion[currentplayer],(int)(screenwidth/2),140);
             buffer2g.drawString("Turns:"+stationturns[currentplayer]+" Kills:"+stationkills[currentplayer]+" Shots:"+stationshots[currentplayer]+" Survives:"+stationsurvive[currentplayer],(int)(screenwidth/2),160);
             buffer2g.drawString("Owngoals:"+stationowngoals[currentplayer]+" Suicides:"+stationsuicide[currentplayer]+" killedby:"+stationkilledby[currentplayer],(int)(screenwidth/2),180);
             buffer2g.drawString("Accuracy:"+(stationkills[currentplayer]/(stationshots[currentplayer]+0.0000001)),(int)(screenwidth/2),200);
             buffer2g.drawString("Angle:"+Angle[currentplayer]+" Power:"+Power[currentplayer],(int)(screenwidth/2),220);
             buffer2g.drawString("Last Angle:"+LastAngle[currentplayer]+"Last Power:"+LastPower[currentplayer],(int)(screenwidth/2),240);
             buffer2g.drawString("X:"+(int)stationx[currentplayer]+" Y:"+(int)stationy[currentplayer]+" x:"+(int)x[currentplayer]+" y:"+(int)y[currentplayer],(int)(screenwidth/2),260);
             buffer2g.drawString("totalpower:"+stationtotalpower[currentplayer]+" vengencekills:"+stationvengencekills[currentplayer]+" strategykills:"+stationstrategykills[currentplayer],(int)(screenwidth/2),300);
             buffer2g.drawString("tacticskills:"+stationtacticskills[currentplayer]+" bullykills:"+stationbullykills[currentplayer]+" opressionkills:"+stationopressionkills[currentplayer],(int)(screenwidth/2),320);
             buffer2g.drawString("longshotkills:"+stationlongshotkills[currentplayer]+" closeshotkills:"+stationcloseshotkills[currentplayer],(int)(screenwidth/2),340);
             buffer2g.drawString("Iradius:"+Iradius[currentplayer]+" stationIradius:"+stationIradius[currentplayer],(int)(screenwidth/2),360);
             buffer2g.drawString("lastdisp:"+lastdisplayed[currentplayer]+"pathl:"+pathl[currentplayer],(int)(screenwidth/2),380);
             buffer2g.drawString("teleports:"+numberofteleports[currentplayer]+"t0:"+teleports[currentplayer][0]+"t1:"+teleports[currentplayer][1]+"t2:"+teleports[currentplayer][2]+"t3:"+teleports[currentplayer][3],(int)(screenwidth/2),400);
              
           }
           //buffer2g.drawString(smallsize+"",60,60);
           //if(focused)buffer2g.drawString("focused",30,340);
	   //if(keydown>0);buffer2g.drawString("DOWN("+keydown+")",30,360);
	   //for(int i=0;i<2000;i++){
           //  spathx[i]=pathx[0][i];
           //  spathy[i]=pathy[0][i];

           //}
           //buffer2g.setColor(Color.white);
	   //buffer2g.drawPolyline(spathx,spathy,pathl[0]);

	g.drawImage(buffer2,0,0,this);
        painted=1;
        drawtime=System.currentTimeMillis()-starttime;
             

    }//if godraw==1
  }//update() 
}







